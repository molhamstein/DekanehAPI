'use strict';

module.exports = function(Warehouse) {

    Warehouse.logProducts = async function(id,shift,cb){

        let warehouse = await Warehouse.app.models.warehouse.findById(id); 
        

        if(!warehouse) 
            throw ERROR(404,"warehouse not found"); 
            
        let warehouseProducts = await warehouse.warehouseProducts.getAsync(); 

        let warehouseProcutsHistory = warehouseProducts.map( (warehouseProduct) => { 

            let { id , warehouse  , ...rest } = warehouseProduct.__data ; 
            return { ...rest ,
                 date: Date.now() , shift , warehouseProductId : id }; 
        }); 

        return await Warehouse.app.models.warehouseProductHistory.create(warehouseProcutsHistory); 
    }
};
