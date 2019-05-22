'use strict';
let ObjectId = require('mongodb').ObjectId;



/**
 * 
 * @param {Number} currentAvg 
 * @param {Number} currentCount 
 * @param {Number} nextCount 
 * @param {Number} diff 
 */
function calcNextAvg(currentAvg, currentCount, nextCount, diff) {
    return (currentAvg * currentCount + diff) / nextCount;
}
module.exports = function (Warehouseproducts) {

    Warehouseproducts.validatesInclusionOf('status', {
        in: ['available', 'unavailable', 'pending']
    });

    Warehouseproducts.prototype.updateExpectedCount = function (expectedCountDiff) {
        this.expectedCount = this.expectedCount + expectedCountDiff;
        return this.save();
    }
    Warehouseproducts.prototype.updatetotalCount = function (totalCountDiff, { buyingPrice, sellingPrice }) {

        this.totalCount = this.totalCount + totalCountDiff;
        if (typeof buyingPrice !== 'undefined') {

            this.avgBuyingPrice = calcNextAvg(this.avgBuyingPrice, this.accumulatedBuyingCountOverTime, this.accumulatedBuyingCountOverTime + totalCountDiff, totalCountDiff * buyingPrice);
            this.accumulatedBuyingCountOverTime += totalCountDiff;

        }
        if (typeof sellingPrice !== 'undefined') {

            totalCountDiff = -totalCountDiff;
            this.avgSellingPrice = calcNextAvg(this.avgSellingPrice, this.accumulatedSellingCountOverTime, this.accumulatedSellingCountOverTime + totalCountDiff, totalCountDiff * sellingPrice);
            this.accumulatedSellingCountOverTime += totalCountDiff;

        }
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

        if (productAbstractId)
            and.push({ productAbstractId: ObjectId(productAbstractId) });


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
                        _id: { month: { $month: "$date" }, day: { $dayOfMonth: "$date" }, year: { $year: "$date" } },
                        count: { $sum: "$expectedCount" },
                        cost: { $sum: { $multiply: ["$expectedCount", "$avgBuyingPrice"] } }
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



    Warehouseproducts.search = function (string, limit = 10, skip = 0, res, cb) {
        var stages = [];

        var nameArMatch = {
            "productAbstract.nameAr": {
                $regex: ".*" + string + ".*"
            }
        }
        var nameEnMatch = {
            "productAbstract.nameEn": {
                $regex: ".*" + string + ".*"
            }
        }



        stages.push(
            {
                $lookup: {
                    from: 'productAbstract',
                    localField: 'productAbstractId',
                    foreignField: '_id',
                    as: 'productAbstract'
                }
            }
            ,
            {
                $unwind: '$productAbstract'
            }
            , {
                $match: {
                    $or: [
                        nameArMatch,
                        nameEnMatch,
                    ]
                }
            }, {
                $skip: skip
            }, {
                $limit: limit
            }

        );

        Warehouseproducts.getDataSource().connector.collection('warehouseProducts')
            .aggregate(stages, function (err, products) {
                if (err)
                    return cb(err);
                return res.json(products)
            });

    }






};


