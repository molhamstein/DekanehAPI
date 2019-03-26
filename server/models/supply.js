'use strict';

module.exports = function (Supply) {


    Supply.beforeRemote('create', async (ctx, modelInstance, next) => {

        if (!ctx.req.accessToken || !ctx.req.accessToken.userId)
            return next(ERROR(403, 'User not login'))

        let supplyProducts = ctx.req.body.products ; 

        if (!supplyProducts || !Array.isArray(supplyProducts) || supplyProducts.length == 0)
            return next(ERROR(400, 'products can\'t be empty', "PRODUCTS_REQUIRED")); 

        let warehouse =  await Supply.app.models.warehouse.findOne({}); 

        // set warehouse for supply 
        ctx.req.body.warehouseId = warehouse.id;

        let supplyProductsIds = supplyProducts.map ( p => p.productAbstractId );
        
        // validate products in db 
        let abstractProducts = await Supply.app.models.productAbstract.find({ where: { id: {'inq': supplyProductsIds}}});  
        if(abstractProducts.length != supplyProductsIds.length ){
            throw ERROR(404,"product not found"); 
        }           
        
        
        //  supply order snapshot 
        let propsToClone = ["nameEn" , "nameAr" , "marketOfficialPrice" , "dockanBuyingPrice", "dockanBuyingPrice", "wholeSaleMarketPrice", "wholeSalePrice" ];       
        for(let supplyProduct of supplyProducts) {

          let abstractProduct = abstractProducts.find( (abstract) => abstract.id == supplyProduct.productAbstractId );
          propsToClone.forEach( (val , index ) => {
              supplyProduct[val] = abstractProduct[val]; 
          }); 

        }

        console.log(supplyProducts); 



       


        next(); 

    });
};
