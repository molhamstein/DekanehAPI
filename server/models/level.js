'use strict';

module.exports = function (Level) {



    Level.calssifyUsers = async function () {
        // @temp
        let previousMonthHigh = new Date();

        previousMonthHigh.setDate(0);
        previousMonthHigh.setHours(23, 59, 59, 0);


        let previousMonthLow = new Date();
        previousMonthLow.setDate(0);
        previousMonthLow.setDate(1);
        previousMonthLow.setHours(0, 0, 0, 0);



        let stages =
            [
                {

                    $lookup: {
                        from: "orders",
                        let: { client: "$_id" },
                        pipeline: [
                            {
                                $sort: { limit: -1 },
                            },
                            {
                                $match:
                                {
                                    $and: [

                                        { orderDate: { $gte: previousMonthLow } },
                                        { orderDate: { $lte: previousMonthHigh } },
                                        {
                                            $expr:
                                            {
                                                $eq: ["$$client", "$clientId"]
                                            }
                                        }
                                    ]

                                }
                            },
                        ],
                        as: "order"


                    },
                },
                {
                    $unwind: {
                        path: "$order",
                        preserveNullAndEmptyArrays: true
                    }


                },
                {
                    $group: {
                        _id: {
                            clientId: "$_id",
                        },
                        price: { $sum: "$order.totalPrice" },
                        count: { $sum: 1 },
                        client: { $first: "$$ROOT" }
                    },

                },
                {
                    $replaceRoot: { newRoot: { $mergeObjects: ["$_id", { price: "$price", count: "$count" }, "$client"] } }
                },

                {
                    $lookup: {
                        from: "level",
                        let: { price: "$price", type: "$clientType" },
                        pipeline: [
                            {
                                $sort: { limit: -1 },
                            },
                            {
                                $match:
                                {
                                    $and: [
                                        {
                                            $expr:
                                            {
                                                $gte: ["$$price", "$limit"]
                                            }
                                        },
                                        {
                                            $expr:
                                            {
                                                $eq: ["$$type", "$clientType"]
                                            }
                                        }
                                    ]

                                }
                            },
                            {
                                $limit: 1
                            }
                        ],
                        as: "level"
                    }
                },
                {
                    $unwind: "$level"
                },
            ];



        let result = await new Promise((res, rej) => {
            Level.getDataSource().connector.collection('user').aggregate(stages, (err, result) => {
                if (err)
                    rej(err);
                else
                    res(result);

            });
        });


        // take a snap shot of users levels 
        let userModel = Level.app.models.user;
        let users = await userModel.find();
        Level.app.models.userHistory.create(users.map(user => new Object({ userSnapshot: user })));

        // count each level's users 
        let levels = await Level.find();
        let levelsCount = {};
        for (let level of levels) {
            levelsCount[level.id] = 0;
        }

        // in case of performance issues do bulk updates 
        for (let userLevel of result) {
            let { level, _id: userId } = userLevel;

            let levelId = level ? level._id : null;
            let user = await userModel.findById(userId);
            if (!levelId) {
                // user has no 
                user.levelId = null;
            } else {
                user.levelId = levelId;
                levelsCount[levelId]++;
            }
            user.save();
        }

        for (let levelId in levelsCount) {
            let level = await Level.findById(levelId);
            level.count = levelsCount[levelId];
            level.save();
        }

        return "Done";


    }
};
