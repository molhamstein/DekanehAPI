'use strict';
let ObjectId = require('mongodb').ObjectId ; 
module.exports = function (Warehouseproducts) {

    Warehouseproducts.validatesInclusionOf('status', {
        in: ['available', 'unavailable', 'pending']
    });

    Warehouseproducts.prototype.updateExpectedCount = function (expectedCountDiff) {
        this.expectedCount = this.expectedCount + expectedCountDiff;
        return this.save();
    }
    Warehouseproducts.prototype.updatetotalCount = function (totalCountDiff) {
        this.totalCount = this.totalCount + totalCountDiff;
        return this.save();
    }
    //Statistics about warehouse products state 
    Warehouseproducts.statistics = async function (req) {
        let collection = Warehouseproducts.app.models.warehouseProducts;
        let warning = collection.count({ and: [{ $expr: { lte: ["$expectedCount", "$warningThreshold"] } }, { $expr: { gt: ["$expectedCount", "$threshold"] } }] });
        let total = collection.count({});
        let stockOut = collection.count({ $expr: { lte: ["$expectedCount", "$threshold"] } });
        [warning, total, stockOut] = await Promise.all([warning, total, stockOut]);

        return { total, warning, stockOut };
    }

    // Daily Report of warehouse products 

    Warehouseproducts.daily = function (res, from, to, productAbstractId) {

        let and = [];
        if (from)
            and.push({ date: { $gte: from } });

        if (to)
            and.push({ date: { $lte: to } });

        if(productAbstractId)
            and.push({productAbstractId : ObjectId( productAbstractId ) } ); 


        if (and.length)
            and = [{ $match: { $and: and } }];


        let stages =
            [

                ...and,
                //{ $sort: { date: -1 } },
                {
                    $group: { // for each day take one and only one record of warehouseProduct log 
                        _id: { warehouseProductId: "$warehouseProductId", month: { $month: "$date" }, day: { $dayOfMonth: "$date" }, year: { $year: "$date" } },
                        grouped: { $first: "$$ROOT" },
                    }
                },
                {
                    $replaceRoot: { newRoot: "$grouped" }
                }, 
                {
                    $group: {
                        _id: {  month: { $month: "$date" }, day: { $dayOfMonth: "$date" }, year: { $year: "$date" } },
                        count: { $sum: "$expectedCount" }, 
                        cost : { $sum : {$multiply : [ "$expectedCount" , "$avgBuyingPrice"] }}
                    }
                }
            ];


        Warehouseproducts.getDataSource().connector.connect((err, db) => {
            let collection = db.collection("warehouseProductHistory");
            collection.aggregate(stages, (err, result) => {
                res.json(result);
            });
        });


    }




};


