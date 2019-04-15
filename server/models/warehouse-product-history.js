'use strict';

module.exports = function(Warehouseproducthistory) {



    Warehouseproducthistory.validatesInclusionOf('shift', {
        in: [1,2,3]
    });

    Warehouseproducthistory.daily = async function(fromDate , toDate){

        return "test"; 

        return Warehouseproducthistory.getDataSource().connector.collection('warehouseProductHistory')
        .find({}); 
   

    }
            
};
