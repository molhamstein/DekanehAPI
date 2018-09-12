'use strict';
var _ = require('lodash')
module.exports = function(Ordersfromsuppliers) {

	Ordersfromsuppliers.beforeRemote('create', function(ctx, modelInstance, next) {
		if(!ctx.req.body.products || !Array.isArray(ctx.req.body.products) || ctx.req.body.products.length == 0)
			return next(ERROR(400,'products required'));

		var products = ctx.req.body.products;
		var productsIds = []
		_.each(products,product =>{
			try{
				productsIds.push(Ordersfromsuppliers.dataSource.ObjectID(product.productId));
			}catch(e){
				return next(ERROR(400,'productId '+ product.productId +' must be ID','PRODUCTID_NOT_ID'))
			}
		});
		console.log(productsIds)
		Ordersfromsuppliers.app.models.products.find({where : {id : {'in' : productsIds}}},function(err,productsFromDb){
			if(err)
				return next(err);
			var productsInfo = {};
			_.each(productsFromDb,p=>{
				productsInfo[p.id.toString()] = p; 
			});
		
			ctx.req.body.totalPrice = 0;
			ctx.req.body.staffId = ctx.req.accessToken.userId;
			_.each(products,product => {
				var pInfo  = productsInfo[product.productId];
				if(!pInfo)
					return;
				product.nameEn = pInfo.nameEn; 
				product.nameAr = pInfo.nameAr;
				ctx.req.body.totalPrice += Number(product.count) * Number(product.price);
			});
			return next();
		});
	});
};
