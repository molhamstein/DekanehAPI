'use strict';
module.exports = async function (app) {
    // roles seed 
    console.log("seeding") ;
    let roles = [

        {
            "nameAr": "admin",
            "nameEn": "admin",
            "privilegeIds": [
                "addRole"
            ]
        },
        {
            "nameAr": "warehousePackager",
            "nameEn": "warehousePackager",
            "privilegeIds": [
                "packageOrder"
            ]
        },
        {
            "nameAr": "warehouseKeeper",
            "nameEn": "warehouseKeeper",
            "privilegeIds": [
                "warehouse_keeper"
            ]
        },
        {
            "nameAr": "deliverer",
            "nameEn": "deliverer",
            "privilegeIds": [
                "userDelivery"
            ]
        }, 
        {
            "nameAr": "sales",
            "nameEn": "sales",
            "privilegeIds": [
            ]
        }     
    ];

    for (let role of roles) {
        await app.models.role.findOrCreate({ where : role } , role);
    }


};