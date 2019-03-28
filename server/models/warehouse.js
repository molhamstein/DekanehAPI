'use strict';

module.exports = function(Warehouse) {

    Warehouse.logProducts = async function(id,shift,cb){

        let warehouse = await Warehouse.app.models.warehouse.findById(id); 
        

        if(!warehouse) 
            throw "warehouse not found"; 

            
        let warehouseProducts = await warehouse.warehouseProducts.getAsync(); 


        let warehouseProcutsHistory = warehouseProducts.map( (warehouseProduct) => { 

            let {avgPrice ,totalCount , expectedCount , accumulatedCountOverTime} = warehouseProduct ; 
            return {avgPrice ,totalCount , expectedCount , accumulatedCountOverTime , 
                 date: Date.now() , shift , warehouseProductId : id }; 
        }); 


        return await Warehouse.app.models.warehouseProductHistory.create(warehouseProcutsHistory); 

    }
};
