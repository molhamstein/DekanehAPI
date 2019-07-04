'use strict';

module.exports = function (Award) {




    Award.afterRemote('create', async function (ctx, modelInstance) {




        let { from, to, occurrence, occurrenceType } = modelInstance;


        if (occurrenceType == 'daily') {

            let nextEnd = (start, occurrence) => {
                let end = new Date(start);
                end.setDate(end.getDate() + occurrence - 1);

                return end;
            };
            let nextStart = (end) => {
                let start = new Date(end);
                start.setDate(start.getDate() + 1);
                return start;
            }

            for (let start = new Date(from), end = nextEnd(start, occurrence);
                end <= to;
                start = nextStart(end),
                end = nextEnd(start, occurrence)) {

                modelInstance.periodsRelation.create({
                    from: new Date(start),
                    to: new Date(end)
                });
            }

        } else if (occurrenceType == 'monthly') {


            let nextEnd = (start, occurrence) => {
                let end = new Date(start);
                end.setMonth(end.getMonth() + occurrence);
                end.setDate(0);
                return end;
            };
            let nextStart = (end) => {
                let start = new Date(end);

                start.setDate(start.getDate() + 1);
                return start;
            }

            let start = new Date(from);
            start.setDate(1);

            for (let end = nextEnd(start, occurrence); end <= to;
                start = nextStart(end),
                end = nextEnd(start, occurrence)) {

                modelInstance.periods.create({
                    from: new Date(start),
                    to: new Date(end)
                });
            }
        } else if (occurrenceType == 'weekly') {


            let nextEnd = (start, occurrence) => {
                let end = new Date(start);
                end.setDate(end.getDate() + occurrence * 7 - 1);
                return end;
            };
            let nextStart = (end) => {
                let start = new Date(end);
                start.setDate(start.getDate() + 1);

                return start;
            }
            let start = new Date(from);
            while (start.getDay() != 6)
                start.setDate(start.getDate() + 1);

            for (let end = nextEnd(start, occurrence);
                end <= to;
                start = nextStart(end),
                end = nextEnd(start, occurrence)) {

                modelInstance.periodsRelation.create({
                    from: new Date(start),
                    to: new Date(end)
                });
            }


        }

    });
    Award.userAwards = async function (user) {

        let { clientType, areaId, levelId } = user;
        let targetDate = new Date();

        return new Promise((res, rej) => {

            Award.getDataSource().connector.collection('award')
                .aggregate(
                    [
                        {
                            $match: {
                                $and: [
                                    {
                                        status: "activated"
                                    },
                                    {
                                        complete: false
                                    },
                                    {
                                        from: { $lte: targetDate },
                                        to: { $gte: targetDate }
                                    },
                                    {
                                        $or: [
                                            { clientTypes: clientType },
                                            { clientTypes: [] }
                                        ]
                                    },
                                    {
                                        $or: [
                                            { areaIds: areaId },
                                            { areaIds: [] }
                                        ]
                                    },
                                    {
                                        $or: [
                                            { levelIds: levelId },
                                            { levelIds: [] }
                                        ]
                                    }
                                ]
                            }
                        },
                        {
                            $lookup: {
                                from: 'awardPeriod',
                                localField: '_id',
                                foreignField: 'awardId',
                                as: 'period'
                            }
                        },
                        {
                            $unwind: "$period"
                        }
                        ,
                        {
                            $match: {
                                "period.from": { $lte: targetDate },
                                "period.to": { $gte: targetDate }

                            }
                        },
                        {
                            $lookup: {
                                from: 'userAward',
                                localField: 'period._id',
                                foreignField: 'awardPeriodId',
                                as: 'userAward'
                            }
                        },

                        {
                            $unwind: {
                                path: "$userAward",
                                preserveNullAndEmptyArrays: true
                            }

                        }
                        ,
                        {
                            $match: {
                                $or: [
                                    { "userAward": null },
                                    { "userAward.complete": false }
                                ]
                            }
                        }

                    ]
                    , (err, result) => {
                        if (err) return rej(err);
                        res(result);
                    });
        });


    }
    Award.me = async function (req) {
        // all my match awards 
        if (!req.user)
            throw ERROR(403, 'user not login');

        return Award.userAwards(req.user, new Date());


    }
};
