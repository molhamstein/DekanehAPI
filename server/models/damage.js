'use strict';
let ObjectId = require("mongodb").ObjectId;

module.exports = function (Damage) {



    Damage.validatesInclusionOf('reason', {
        in: ['expired', 'damaged', 'other']
    });

    /**
    * 
    * @param {DamageProducts[]} damageProducts Array of DamageProducts to create snapshot 
    * @param {AbstractProduct[]} abstractProducts Array of AbstractProduct the souce model to be cloned 
    */
    function assignDamageProductsSnapshot(damageProducts, abstractProducts) {


        let propsToClone = ["nameEn", "nameAr", "officialConsumerPrice", "officialMassMarketPrice", "media", "id"];


        for (let damageProduct of damageProducts) {

            let abstractProduct = abstractProducts.find((abstract) => abstract.id == damageProduct.productAbstractId);
            let snapshot = {};
            propsToClone.forEach((val, index) => {
                snapshot[val] = abstractProduct[val];
            });
            damageProduct.productAbstractSnapshot = snapshot;
        }

    }

    /**
     * 
     * @param {DamageProducts[]} damageProducts damageProducts to create the update from 
     * @param {Warehouse} warehouse  warehouse to create the updates for its products
     * @returns {warehouseProduct , countDiff } WarehouseProduct to update its count in CountDiff 
     */
    async function createDamageProductsWarehouseUpdates(damageProducts, warehouse) {

        let warehouseProductUpdates = [];
        for (let damageProduct of damageProducts) {

            let productAbstractId = damageProduct.productAbstractId;
            let warehouseProduct = await warehouse.warehouseProducts.findOne({ where: { productAbstractId } });
            if (!warehouseProduct)
                throw ERROR(422, 'product has no warehouse product');
            warehouseProductUpdates.push({ warehouseProduct, countDiff: damageProduct.count });
        }
        return warehouseProductUpdates;
    }
    Damage.beforeRemote('create', async (ctx, modelInstance, next) => {

        // validate user 
        if (!ctx.req.accessToken || !ctx.req.accessToken.userId)
            throw (ERROR(403, 'User not login'))

        let damageProducts = ctx.req.body.products;

        // validate products existance 
        if (!damageProducts || !Array.isArray(damageProducts) || damageProducts.length == 0)
            throw (ERROR(400, 'products can\'t be empty', "PRODUCTS_REQUIRED"));

        let warehouse = await Damage.app.models.warehouse.findOne({});

        // set warehouse for damage 
        ctx.req.body.warehouseId = warehouse.id;

        let damageProductsIds = damageProducts.map(p => p.productAbstractId);

        // validate products in db 
        let abstractProducts = await Damage.app.models.productAbstract.find({ where: { id: { 'inq': damageProductsIds } } });
        if (abstractProducts.length != damageProductsIds.length) {
            throw ERROR(404, "product not found");
        }

        // create snapshots of abstractProduct 
        assignDamageProductsSnapshot(damageProducts, abstractProducts);

        ctx.damageProducts = damageProducts;
        delete ctx.req.body.products;

    });
    Damage.afterRemote('create', async (ctx, damage, next) => {
        let { damageProducts } = ctx;

        let createdDamageProducts = await damage.damageProducts.create(damageProducts);

        let warehouse = await damage.warehouse.getAsync();
        // update warehouse product 
        let warehouseProductUpdates = await createDamageProductsWarehouseUpdates(createdDamageProducts, warehouse);
        for (let { warehouseProduct, countDiff } of warehouseProductUpdates) {
            await warehouseProduct.updateExpectedCount(-countDiff);
            await warehouseProduct.updatetotalCount(-countDiff);
        }

    });

    Damage.daily = function (res, from, to, productAbstractId, cb) {

        let and = [];
        if (from)
            and.push({ date: { $gte: from } });

        if (to)
            and.push({ date: { $lte: to } });


        if (and.length)
            and = [{ $match: { $and: and } }];

        let matchProductAbstractId = [];

        if (productAbstractId) {
            matchProductAbstractId.push({ $match: { "damageProduct.productAbstractId": ObjectId(productAbstractId) } });
        }

        let stages =
            [
                ...and,
                {
                    $lookup: {
                        from: 'damageProduct',
                        localField: '_id',
                        foreignField: 'damageId',
                        as: 'damageProduct'
                    }
                },
                {
                    $unwind: "$damageProduct"
                },
                ...matchProductAbstractId
                ,
                {
                    $group: {
                        _id: { month: { $month: "$date" }, day: { $dayOfMonth: "$date" }, year: { $year: "$date" } },
                        count: { $sum: "$damageProduct.count" },
                        cost: { $sum: { $multiply: ["$damageProduct.count", "$damageProduct.productAbstractSnapshot.officialMassMarketPrice"] } }
                    }
                }
            ];
        //productAbstractId: "$damageProduct.productAbstractId",

        let productsStages = [
            ...and,
            {
                $lookup: {
                    from: 'damageProduct',
                    localField: '_id',
                    foreignField: 'damageId',
                    as: 'damageProduct'
                }
            },
            {
                $unwind: "$damageProduct"
            },
            ...matchProductAbstractId
            ,
            {
                $group: {
                    _id: { productAbstractId: "$damageProduct.productAbstractId" },
                    count: { $sum: "$damageProduct.count" },
                    cost: { $sum: { $multiply: ["$damageProduct.count", "$damageProduct.productAbstractSnapshot.officialMassMarketPrice"] } }
                }
            }
        ];


        Damage.getDataSource().connector.connect((err, db) => {
            let collection = db.collection("damage");
            collection.aggregate(stages, (err, result) => {

                collection.aggregate(productsStages, (err, productsResult) => {
                    res.json({ result, products: productsResult });
                });

            });
        });

    }

};
