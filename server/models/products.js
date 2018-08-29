'use strict';
var _ = require('lodash');
module.exports = function(Products) {
	Products.validatesInclusionOf('status', {in: ['available', 'unAvailable']});
	Products.validatesPresenceOf('categoryId');	

	Products.afterRemote('create', function(ctx,result, next) {
		if(!result.isOffer)
			return next();
		if(!result.productsIds || result.productsIds.length == 0)
			return next();
		var offerId = result.id;
		console.log(result.productsIds);
		Products.updateAll({_id : {in : result.productsIds}}, {$push: {offersIds: offerId}}, function(err, info) {
		    if(err)
		    	console.log(err);
		    return next()
		});

	});	

	Products.getCategoriesWithProducts = function(limitPerCategory= 10,cb){
		Products.getDataSource().connector.collection('products')
		.aggregate([
			{ $match: {isOffer : false, status : "available" }},
			{
				$lookup:{
			       from: 'categories',
			       localField: 'categoryId',
			       foreignField: '_id',
			       as: 'category'
			    }
			},
			{
				$lookup:{
			       from: 'categories',
			       localField: 'subCategoryId',
			       foreignField: '_id',
			       as: 'subCategory'
			    }
			},
			{
				$lookup:{
			       from: 'manufacturers',
			       localField: 'manufacturerId',
			       foreignField: '_id',
			       as: 'manufacturer'
			    }
			},
			{ $project: { 
					"nameAr": 1,
				    "nameEn": 1,
				    "image": 1,
				    "pack": 1,
				    "description": 1,
				    "retailPrice": 1,
				    "wholeSalePrice": 1,
				    "wholeSaleMarketPrice": 1,
				    "marketPrice": 1,
				    "retailPriceDiscount": 1,
				    "wholeSalePriceDiscount":1,
				    "isFeatured": 1, 
				    "status": 1,
				    "isOffer": 1,
				    "categoryId": 1,	
				    "subCategoryId": 1,
				    "offersIds": 1,
				    "productsIds": 1,
				    "tagsIds": 1,
					"manufacturerId" : 1,
					"category": { "$arrayElemAt": [ "$category", 0 ] },
					"subCategory": { "$arrayElemAt": [ "$subCategory", 0 ] },
					"manufacturer": { "$arrayElemAt": [ "$manufacturer", 0 ] }
				}
			},
			{ $group : {_id : '$categoryId', info: { $first: "$category" },cat : '$category.0.titleEn', products : {$push : '$$ROOT'}}}, 
			{ $project : { info : 1,  products : {$slice: [ "$products", limitPerCategory] }}}       
	    ],cb)

	}
	Products.remoteMethod('getCategoriesWithProducts', {
    	description: 'get products grouped by categories   == 10 product in each category',
		accepts: [
			{arg: 'limit', type: 'number', 'http': {source: 'query'}}
		],
		returns: {arg: 'body', type: 'body',root: true},
		http: {verb: 'get',path: '/groupedByCategories'},
    });



	// Products.testExcel = function(cb){
	// 	var mongoXlsx = require('mongo-xlsx');
	// 	Products.find({},function(err,data){
	// 		// example 
	// 		data[0].products = ["name=B","price=500"]
	// 		var config = {path : 'files/excelFiles',save : true,fileName : 'products'+Date.now()+'.xlsx'};
	// 		mongoXlsx.mongoData2Xlsx(data, model,config, function(err, data) {
	// 			console.log(data)
	// 			console.log('File saved at:', data.fullPath);
	// 			mongoXlsx.xlsx2MongoData(data.fullPath,model,config,function(err,rows){
	// 				console.log(err,rows);
	// 			}) 
	// 		});


	// 	});
	// }
	// Products.remoteMethod('testExcel', {
	// 	returns: {arg: 'message', type: 'string'},
	// 	http: {verb: 'get',path: '/testExcel'},
 //    });
};



// for import/export Excel
var model = [
	{
	    displayName: "ID",
	    access: "id",
	    type: "string"
    },
    {
	    displayName: "Arabic Name",
	    access: "nameAr",
	    type: "string"
    },
    {
	    displayName: "English Name",
	    access: "nameEn",
	    type: "string"
    },
    {
	    displayName: "image",
	    access: "image",
	    type: "string"
    },
    {
	    displayName: "manufacturer",
	    access: "manufacturer",
	    type: "string"
    },
    {
	    displayName: "pack",
	    access: "pack",
	    type: "string"
    },
    {
	    displayName: "description",
	    access: "description",
	    type: "string"
    },
    {
	    displayName: "retailPrice",
	    access: "retailPrice",
	    type: "number"
    },
    {
	    displayName: "wholeSalePrice",
	    access: "wholeSalePrice",
	    type: "number"
    },
    {
	    displayName: "marketPrice",
	    access: "marketPrice",
	    type: "number"
    },
    {
	    displayName: "retailPriceDiscount",
	    access: "retailPriceDiscount",
	    type: "number"
    },
    {
	    displayName: "wholeSalePriceDiscount",
	    access: "wholeSalePriceDiscount",
	    type: "number"
    },
    {
	    displayName: "products",
	    access: "products",
	    type: "string"
    },
    {
	    displayName: "is Featured",
	    access: "isFeatured",
	    type: "boolean"
    },
    {
	    displayName: "status",
	    access: "status",
	    type: "string"
    },
    {
	    displayName: "category ID",
	    access: "categoryId",
	    type: "string"
    },
    {
	    displayName: "subCategory ID",
	    access: "subCategoryId",
	    type: "string"
    },
]