'use strict';

// suplly order status enumeration 
const SupplyOrderStatus = { Pending: "pending", Canceled: "canceled", Delivered: "delivered" };


module.exports = function (Supply) {



    Supply.validatesInclusionOf('status', {
        in: Object.values(SupplyOrderStatus)
    });

    Supply.validatesPresenceOf('warehouseId', 'supplierId');



    /**
     * 
     * @param {SupplyProduct[]} supplyProducts Array of SupplyProduct to create snapshot 
     * @param {AbstractProduct[]} abstractProducts Array of AbstractProduct the souce model to be cloned 
     */
    function assignSupplyProductsSnapshot(supplyProducts, abstractProducts) {


        //  supply order snapshot 
        let propsToClone = ["nameEn", "nameAr", "officialConsumerPrice", "officialMassMarketPrice", "media", "id"];


        for (let supplyProduct of supplyProducts) {

            let abstractProduct = abstractProducts.find((abstract) => abstract.id == supplyProduct.productAbstractId);
            let snapshot = {};
            propsToClone.forEach((val, index) => {
                snapshot[val] = abstractProduct[val];
            });
            supplyProduct.productAbstractSnapshot = snapshot;
        }

    }
    /**
     * 
     * @param {SupplyProducts[]} supplyProducts supplyProducts to calculate total price for 
     * @returns {number} Total Price
     */
    function calcSupplyProductsTotalPrice(supplyProducts) {
        return supplyProducts.reduce((accumulator, { count, buyingPrice }) => accumulator + count * buyingPrice, 0);
    }
    /**
     * 
     * @param {SupplyProducts[]} supplyProducts supplyProducts to create the update from 
     * @param {Warehouse} warehouse  warehouse to create the updates for its products
     * @returns {warehouseProduct , countDiff } WarehouseProduct to update its count in CountDiff 
     */
    async function createSupplyProductsWarehouseUpdates(supplyProducts, warehouse) {

        let warehouseProductUpdates = [];
        for (let supplyProduct of supplyProducts) {

            let productAbstractId = supplyProduct.productAbstractId;
            let warehouseProduct = await warehouse.warehouseProducts.findOne({ where: { productAbstractId } });
            if (!warehouseProduct)
                throw ERROR(422, 'product has no warehouse product');
            warehouseProductUpdates.push({ warehouseProduct, countDiff: supplyProduct.count, buyingPrice: supplyProduct.buyingPrice });
        }
        return warehouseProductUpdates;
    }
    Supply.beforeRemote('create', async (ctx, modelInstance, next) => {

        let supplierId = ctx.req.body.supplierId; 
        if(!supplierId){
            throw (ERROR(403, 'supplierId is required'));             
        }
        let supplyer = await Supply.app.models.supplier.findById(supplierId); 

        //validate supplyer
        if(!supplyer){
            throw (ERROR(404, 'Supplier not found')); 
        }

        // validate user 
        if (!ctx.req.accessToken || !ctx.req.accessToken.userId)
            throw (ERROR(403, 'User not login')); 

        let supplyProducts = ctx.req.body.products;

        // validate products existance 
        if (!supplyProducts || !Array.isArray(supplyProducts) || supplyProducts.length == 0)
            throw (ERROR(400, 'products can\'t be empty', "PRODUCTS_REQUIRED"));

        let warehouse = await Supply.app.models.warehouse.findOne({});

        // set warehouse for supply 
        ctx.req.body.warehouseId = warehouse.id;
        //set supply status 
        ctx.req.body.status = SupplyOrderStatus.Pending;


        let supplyProductsIds = supplyProducts.map(p => p.productAbstractId);

        // validate products in db 
        let abstractProducts = await Supply.app.models.productAbstract.find({ where: { id: { 'inq': supplyProductsIds } } });
        if (abstractProducts.length != supplyProductsIds.length) {
            throw ERROR(404, "product not found");
        }

        // create snapshots of abstractProduct 
        assignSupplyProductsSnapshot(supplyProducts, abstractProducts);

        ctx.supplyProducts = supplyProducts;
        delete ctx.req.body.products;


        // calculate supply order total price 
        let totalPrice = calcSupplyProductsTotalPrice(supplyProducts);
        ctx.req.body.totalPrice = totalPrice;

    });
    Supply.afterRemote('create', async (ctx, supply, next) => {
        let { supplyProducts } = ctx;

        let createdSupplyProducts = await supply.supplyProducts.create(supplyProducts);

    });

    Supply.deliver = async function (id) {

        let supply = await Supply.app.models.supply.findById(id);

        if (supply.status !== SupplyOrderStatus.Pending) {
            throw ERROR(400, "supply order is not pending");
        }

        let warehouse = await supply.warehouse.getAsync();
        // update warehouse product 
        let supplyProducts = supply.supplyProducts();
        let warehouseProductUpdates = await createSupplyProductsWarehouseUpdates(supplyProducts, warehouse);
        for (let { warehouseProduct, countDiff, buyingPrice } of warehouseProductUpdates) {
            await warehouseProduct.updateExpectedCount(countDiff);
            await warehouseProduct.updatetotalCount(countDiff, { buyingPrice });
        }

        // set supply status to deliver 
        supply.status = SupplyOrderStatus.Delivered;
        supply.deliverDate = Date.now();

        return supply.save();
    }

    Supply.cancel = async function (id) {


        let supply = await Supply.app.models.supply.findById(id);

        if (supply.status !== SupplyOrderStatus.Pending) {
            throw ERROR(400, "supply order is not pending");
        }

        // set supply status to cancel 
        supply.status = SupplyOrderStatus.Canceled;
        supply.cancelDate = Date.now();
        return supply.save();

    }


    Supply.edit = async function (id, ctx) {


        // validate user 
        if (!ctx.req.accessToken || !ctx.req.accessToken.userId)
            throw (ERROR(403, 'User not login'))

        let supply = await Supply.app.models.supply.findById(id);

        if (!supply)
            throw (ERROR(404, 'Supply order not found'));


        if (supply.status !== SupplyOrderStatus.Pending)
            throw ERROR(400, "supply order is not pending");




        let supplyProducts = ctx.req.body.products;

        // validate products existance 
        if (!supplyProducts || !Array.isArray(supplyProducts) || supplyProducts.length == 0)
            throw (ERROR(400, 'products can\'t be empty', "PRODUCTS_REQUIRED"));


        let supplyProductsIds = supplyProducts.map(p => p.productAbstractId);

        // validate products in db 
        let abstractProducts = await Supply.app.models.productAbstract.find({ where: { id: { 'inq': supplyProductsIds } } });
        if (abstractProducts.length != supplyProductsIds.length) {
            throw ERROR(404, "product not found");
        }


        // create snapshots of abstractProduct 
        assignSupplyProductsSnapshot(supplyProducts, abstractProducts);

        // remove products from request  
        delete ctx.req.body.products;


        // calculate supply order total price 
        let totalPrice = calcSupplyProductsTotalPrice(supplyProducts);
        ctx.req.body.totalPrice = totalPrice;

        let oldSupplyProducts = [... await supply.supplyProducts()];


        // updateAttributes
        await supply.updateAttributes(ctx.req.body);
        // remove old products 
        await supply.supplyProducts.destroyAll();
        // create new products 

        let createdSupplyProducts = await supply.supplyProducts.create(supplyProducts);


        return supply;
    }


    Supply.daily = function (res, from, to, productAbstractId, cb) {

        let and = [];
        if (from)
            and.push({ createDate: { $gte: from } });

        if (to)
            and.push({ createDate: { $lte: to } });


        if (and.length)
            and = [{ $match: { $and: and } }];

        let matchProductAbstractId = [];

        if (productAbstractId) {
            matchProductAbstractId.push({ $match: { "supplyProduct.productAbstractId": ObjectId(productAbstractId) } });
        }

        let stages =
            [
                ...and,
                {
                    $lookup: {
                        from: 'supplyProduct',
                        localField: '_id',
                        foreignField: 'supplyId',
                        as: 'supplyProduct'
                    }
                },
                {
                    $unwind: "$supplyProduct"
                },
                ...matchProductAbstractId
                ,
                {
                    $group: {
                        _id: { month: { $month: "$createDate" }, day: { $dayOfMonth: "$createDate" }, year: { $year: "$createDate" } },
                        count: { $sum: "$supplyProduct.count" },
                        cost: { $sum: { $multiply: ["$supplyProduct.count", "$supplyProduct.buyingPrice"] } }
                    }
                }
            ];

        let productsStages = [
            ...and,
            {
                $lookup: {
                    from: 'supplyProduct',
                    localField: '_id',
                    foreignField: 'supplyId',
                    as: 'supplyProduct'
                }
            },
            {
                $unwind: "$supplyProduct"
            },
            ...matchProductAbstractId
            ,
            {
                $group: {
                    _id: { productAbstractId: "$supplyProduct.productAbstractId" },
                    count: { $sum: "$supplyProduct.count" },
                    cost: { $sum: { $multiply: ["$supplyProduct.count", "$supplyProduct.buyingPrice"] } } , 
                    productAbstractSnapshot : { $first : "$supplyProduct.productAbstractSnapshot"}
                }
            },
            
        ];


        Supply.getDataSource().connector.connect((err, db) => {
            let collection = db.collection("supply");
            collection.aggregate(stages, (err, result) => {

                collection.aggregate(productsStages, (err, productsResult) => {
                    res.json({ result, products: productsResult });
                });

            });
        });

    }

    

};
