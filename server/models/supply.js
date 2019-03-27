'use strict';

module.exports = function (Supply) {


    /**
     * 
     * @param {SupplyProduct[]} supplyProducts Array of SupplyProduct to create snapshot 
     * @param {AbstractProduct[]} abstractProducts Array of AbstractProduct the souce model to be cloned 
     */
    function assignSupplyProductsSnapshot(supplyProducts , abstractProducts){

        
        //  supply order snapshot 
        let propsToClone = ["nameEn" , "nameAr" , "officialConsumerPrice" , "officialMassMarketPrice"];       
        

        for(let supplyProduct of supplyProducts) {

          let abstractProduct = abstractProducts.find( (abstract) => abstract.id == supplyProduct.productAbstractId );
          let snapshot = {}; 
          propsToClone.forEach( (val , index ) => {
              snapshot[val] = abstractProduct[val]; 
          }); 
          supplyProduct.supplyProductSnapshot = snapshot; 
        }

    }
    /**
     * 
     * @param {SupplyProducts[]} supplyProducts supplyProducts to calculate total price for 
     * @returns {number} Total Price
     */
    function calcSupplyProductsTotalPrice(supplyProducts){
        return supplyProducts.reduce( (accumulator , {count , price }) => accumulator + count * price , 0); 
    }
    Supply.beforeRemote('create', async (ctx, modelInstance, next) => {

        // validate user 
        if (!ctx.req.accessToken || !ctx.req.accessToken.userId)
            throw (ERROR(403, 'User not login'))

        let supplyProducts = ctx.req.body.products ; 

        // validate products existance 
        if (!supplyProducts || !Array.isArray(supplyProducts) || supplyProducts.length == 0)
            throw (ERROR(400, 'products can\'t be empty', "PRODUCTS_REQUIRED")); 

        let warehouse =  await Supply.app.models.warehouse.findOne({}); 
        
        // set warehouse for supply 
        ctx.req.body.warehouseId = warehouse.id;
        let supplyProductsIds = supplyProducts.map ( p => p.productAbstractId );
    
        // validate products in db 
        let abstractProducts = await Supply.app.models.productAbstract.find({ where: { id: {'inq': supplyProductsIds}}});  
        if(abstractProducts.length != supplyProductsIds.length ){
            throw ERROR(404,"product not found"); 
        }           

        // create snapshots of abstractProduct 
        assignSupplyProductsSnapshot(supplyProducts , abstractProducts); 

        ctx.supplyProducts =  supplyProducts; 
        delete ctx.req.body.products; 


        // calculate supply order total price 
        let totalPrice = calcSupplyProductsTotalPrice(supplyProducts); 
        ctx.req.body.totalPrice = totalPrice ; 
    
    });

    
    Supply.afterRemote('create',  (ctx, modelInstance, next) => {
      console.log(ctx.supplyProducts) ; 

      next(); 
    }); 
};
