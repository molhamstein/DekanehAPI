'use strict';

module.exports = function (Warehouse) {

    async function logProducts (warehouse, warehouseKeeperId) {


        let warehouseProducts = await warehouse.warehouseProducts.getAsync();
        let warehouseProcutsHistory = warehouseProducts.map((warehouseProduct) => {

            let { id, warehouse, ...rest } = warehouseProduct.__data;
            return {
                ...rest,
                date: Date.now(), warehouseKeeperId, warehouseProductId: id
            };
        });

        return await Warehouse.app.models.warehouseProductHistory.create(warehouseProcutsHistory);
    }



    Warehouse.login = async function (id, req, cb) {

        let warehouse = await Warehouse.app.models.warehouse.findById(id);


        if (!warehouse)
            throw ERROR(404, "warehouse not found");


            
        let {user} = req; 
        if(!user) 
                throw ERROR(403 , "User not login"); 

        if (!user.hasPrivilege('warehouse_keeper'))
            throw ERROR(400, 'user is not warehouse keeper');

        if(user.state == "in"){
                throw ERROR(409, "user already logged into warehouse "); 
        }     

        user.state = "in"; 
        await user.save(); 

        return user; 

    }


    
    Warehouse.logout = async function (id, req, cb) {

        let warehouse = await Warehouse.app.models.warehouse.findById(id);


        if (!warehouse)
            throw ERROR(404, "warehouse not found");

            
        let {user} = req; 
        if(!user) 
                throw ERROR(403 , "User not login"); 

        if (!user.hasPrivilege('warehouse_keeper'))
            throw ERROR(400, 'user is not warehouse keeper');

        if(user.state != "in"){
//                throw ERROR(409, "user already logged out "); 
        }     

        user.state = "out"; 
        await user.save(); 

        return await logProducts(warehouse , user.id); 
        
    }


};
