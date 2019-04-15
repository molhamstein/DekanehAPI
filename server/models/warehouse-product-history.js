'use strict';

module.exports = function(Warehouseproducthistory) {



    Warehouseproducthistory.validatesInclusionOf('shift', {
        in: [1,2,3]
    });

    Warehouseproducthistory.daily =  function(res , fromDate , toDate){
        let stages = 
        [
            //{ $sort: { date: -1 } },
            {
                $group: {
                    _id: { warehouseProductId : "$warehouseProductId" ,  month: { $month: "$date" }, day: { $dayOfMonth: "$date" }, year: { $year: "$date" }  },
                    grouped: { $first: "$$ROOT" },                     
                }  
                
            },
            {
                $replaceRoot: { newRoot: "$grouped" }
            } , 
            {
                $group: {
                _id: { warehouseProductId : "$warehouseProductId" } , 
                dates : { $push : "$$ROOT"}
                }
            }
        ];
        Warehouseproducthistory.getDataSource().connector.connect((err, db) => {
            let collection = db.collection("warehouseProductHistory");
            collection.aggregate(stages, (err, result) => {
                res.json(result);
            });
        });


    }
            
};
