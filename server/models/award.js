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


};
