'use strict';

// suplly order status enumeration 
const SupplyOrderStatus = { Pending: "pending", Canceled: "canceled", Delivered: "delivered" };


module.exports = function (Supply) {



    Supply.validatesInclusionOf('status', {
        in: Object.values(SupplyOrderStatus)
    });

    /**
     * 
     * @param {SupplyProduct[]} supplyProducts Array of SupplyProduct to create snapshot 
     * @param {AbstractProduct[]} abstractProducts Array of AbstractProduct the souce model to be cloned 
     */
    function assignSupplyProductsSnapshot(supplyProducts, abstractProducts) {


        //  supply order snapshot 
        let propsToClone = ["nameEn", "nameAr", "officialConsumerPrice", "officialMassMarketPrice"];


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
            warehouseProductUpdates.push({ warehouseProduct, countDiff: supplyProduct.count });
        }
        return warehouseProductUpdates;
    }
    Supply.beforeRemote('create', async (ctx, modelInstance, next) => {

        // validate user 
        if (!ctx.req.accessToken || !ctx.req.accessToken.userId)
            throw (ERROR(403, 'User not login'))

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
        for (let { warehouseProduct, countDiff } of warehouseProductUpdates) {
            await warehouseProduct.updateExpectedCount(countDiff);
            await warehouseProduct.updatetotalCount(countDiff);
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

};
