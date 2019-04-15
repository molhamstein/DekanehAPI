'use strict';

module.exports = function(Warehouseproducthistory) {



    Warehouseproducthistory.validatesInclusionOf('shift', {
        in: [1,2,3]
    });

    Warehouseproducthistory.daily =  function(res , fromDate , toDate){




        let stages = 

        [
            {
                $group: {
                    _id: { warehouseProductId : "$warehouseProductId"  },
                    warehouseProduct: { $push: "$$ROOT" },                     
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
