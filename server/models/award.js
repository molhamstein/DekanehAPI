'use strict';

module.exports = function (Award) {




    Award.afterRemote('create', async function (ctx, modelInstance) {




        let { from, to, every } = modelInstance;

        let nextEnd = (start, every) => {
            let end = new Date(start);
            end.setDate(end.getDate() + every - 1);
            return end;
        };


        for (let start = new Date(from), end = nextEnd(start, every); end <= to; start = new Date(end), start.setDate(start.getDate() + 1), end = nextEnd(start, every)) {
            
            modelInstance.periodsRelation.create({
                from: new Date(start),
                to: new Date(end)
            });
        }

      

        

    });


};
