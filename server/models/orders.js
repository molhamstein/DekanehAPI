'use strict';

var _ = require('lodash')
module.exports = function(Orders) {
	Orders.validatesInclusionOf('status', {in: ['pending', 'inDelivery', 'delivered','canceled']});

	Orders.beforeRemote('create', function(ctx, modelInstance, next) {
		if(!ctx.req.accessToken || !ctx.req.accessToken.userId){
			var err1 = new Error('User not login');
	        err1.statusCode = 403;
	        err1.code = 'USER_NOT_LOGIN';
			return next(err1)
		}

		if(!ctx.req.body.products || !Array.isArray(ctx.req.body.products) || ctx.req.body.products.length == 0){
			var err = new Error('products can\'t be empty');
			err.statusCode = 400;
			err.code = 'PRODUCTS_REQUIRED';
			return next(err);
		}
		var products = ctx.req.body.products;

		var productsIds = []
		_.each(products,product =>{
			try{
				productsIds.push(Orders.dataSource.ObjectID(product.productId));
			}catch(e){
				var err = new Error('productId must be ID');
				err.statusCode = 400;
				err.code = 'PRODUCTID_NOT_ID';
				return next(err);
			}
		})
		Orders.app.models.user.findById(ctx.req.accessToken.userId,(err,user)=>{
			if(err)
				return next(err);
			if(!user){
				var err = new Error('products can\'t be empty');
				err.statusCode = 400;
				err.code = 'PRODUCTS_REQUIRED';
				return next(err);
			}

			Orders.app.models.products.find({where : {id : {'in' : productsIds}}},function(err,productsFromDb){
				if(err)
					return next(err);

				ctx.req.body.clientType = user.clientType;
				ctx.req.body.totalPrice = 0;

				var productsInfo = {};
				_.each(productsFromDb,p=>{
					productsInfo[p.id.toString()] = p; 
				});

				_.each(products,product => {
					var pInfo  = productsInfo[product.productId];
					if(!pInfo)
						return;
					product.nameEn = pInfo.nameEn; 
					product.nameAr = pInfo.nameAr; 
					product.pack = pInfo.pack; 
					product.description = pInfo.description; 
					if(user.clientType == 'wholesale'){
						product.price = (pInfo.wholeSalePriceDiscount && pInfo.wholeSalePriceDiscount) == 0? pInfo.wholeSalePrice: pInfo.wholeSalePriceDiscount ; 
					}
					else{
						product.price = (pInfo.retailPriceDiscount && pInfo.retailPriceDiscount) == 0? pInfo.retailPrice: pInfo.retailPriceDiscount ; 
					}
					ctx.req.body.totalPrice += Number(product.count) * Number(product.price);
					product.isOffer = pInfo.isOffer;
					if(pInfo.isOffer) product.products = pInfo.products();
				});
	    		return next();
			});
		});
	});

};
