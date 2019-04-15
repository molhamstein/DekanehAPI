'use strict';

module.exports = function(Warehouseproducthistory) {



    Warehouseproducthistory.validatesInclusionOf('shift', {
        in: [1,2,3]
    });

    Warehouseproducthistory.daily =  function(res , from , to){


        
        let and = []; 
        if(from)
            and.push({ date : { $gte : from  } }); 
        
        if(to)
            and.push({ date : { $lte : to }}); 
        
        if(and.length)
            and = [ {$match : { $and : and  } }]; 
        

        let stages = 
        [

            ...and ,
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
