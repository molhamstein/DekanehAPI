'use strict';
var mongoXlsx = require('mongo-xlsx');
var _ = require('lodash');
var path = require('path');
module.exports = function(Products) {
	// Products.validatesInclusionOf('status', {in: ['available', 'unAvailable']});
	Products.validatesInclusionOf('offerSource', {in: ['dockan', 'company','supplier']});
	Products.validatesInclusionOf('availableTo', {in: ['both', 'wholesale','retailCostumer']});
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
				    "marketOfficialPrice":1,
				    "marketOfficialPrice":1,
				    "dockanBuyingPrice":1,
				    "availableTo":1,
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
			{ $group : {_id : '$categoryId', info: { $first: "$category" }, products : {$push : '$$ROOT'}}}, 
			{ $project : {titleEn : '$info.titleEn', titleAr : '$info.titleAr',  products : {$slice: [ "$products", limitPerCategory] }}}       
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

    Products.getManufacturersWithProducts = function(categoryId,subCategoryId,limitPerManufacturer= 10,cb){
		var where = {status : "available" };
		if(categoryId)
			where.categoryId = Products.dataSource.ObjectID(categoryId);
		if(subCategoryId)
			where.subCategoryId = Products.dataSource.ObjectID(subCategoryId);
		console.log(where);
		Products.getDataSource().connector.collection('products')
		.aggregate([
			{ $match: where},
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
				    "marketOfficialPrice":1,
				    "marketOfficialPrice":1,
				    "dockanBuyingPrice":1,
				    "availableTo":1,
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
			{ $group : {_id : '$manufacturerId', info: { $first: "$manufacturer" }, products : {$push : '$$ROOT'}}}, 
			{ $project : {nameEn : '$info.nameEn', nameAr : '$info.nameAr',  products : {$slice: [ "$products", limitPerManufacturer] }}}       
	    ],cb)
	}

    Products.remoteMethod('getManufacturersWithProducts', {
    	description: 'get products grouped by manufacturer   == 10 product in each manufacturer',
		accepts: [
			{arg: 'categoryId', type: 'string', 'http': {source: 'query'}},
			{arg: 'subCategoryId', type: 'string', 'http': {source: 'query'}},
			{arg: 'limit', type: 'number', 'http': {source: 'query'}}
		],
		returns: {arg: 'body', type: 'body',root: true},
		http: {verb: 'get',path: '/groupedByManufacturers'},
    });



    Products.similarProduct = function(productId,limit=10,res,cb){

    	Products.findById(productId,function(err,product){
    		if(err)
    			return cb(err);
    		if(!product)
    			return cb(ERROR(404, 'product not found'));

			Products.getDataSource().connector.collection('products')
			.aggregate([
				{ $match: {_id : {$ne : product.id}, tagsIds : {$in : product.tagsIds}} },
				{ $project: { 
					tagsIds: 1, 
					rank: {$size : { $setIntersection: [ "$tagsIds", product.tagsIds ] }},
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
				    "marketOfficialPrice":1,
				    "marketOfficialPrice":1,
				    "dockanBuyingPrice":1,
				    "availableTo":1,
				    "isFeatured": 1, 
				    "status": 1,
				    "isOffer": 1,
				    "categoryId": 1,	
				    "subCategoryId": 1,
				    "offersIds": 1,
				    "productsIds": 1,
				    "tagsIds": 1,
					"manufacturerId" : 1
				}},
				{ $sort: {rank : -1} },
				{ $limit : limit},
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
				    "marketOfficialPrice":1,
				    "marketOfficialPrice":1,
				    "dockanBuyingPrice":1,
				    "availableTo":1,
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
				}},
	     	],function(err,products){
		     	if(err)  
		     		return cb(err);
		     	return res.json(products)
		     });
    	});
	}


	Products.remoteMethod('similarProduct', {
		accepts: [
			{arg: 'productId', type: 'string', 'http': {source: 'query'}},
			{arg: 'limit', type: 'number', 'http': {source: 'query'}},
			{arg: 'res', http: {source: 'res'}}
		],
		http: {verb: 'get',path: '/similarProduct'},
    });
	// app.dataSources.mongoDb
	// .connector.connect(function(err, db) {
 //      db.collection('products').createIndex({ titleAr: "text", titleEn: "text" }, function(err) {
 //      });
 //    })
	Products.search = function(string,isOffer,limit=10,res,cb){
		var stages = []
		if(isOffer != undefined)
			stages.push({$match : {isOffer : isOffer.toLowerCase() == 'true' ? true : false}});

		stages.push(
			{
				$lookup:{
			       from: 'manufacturers',
			       localField: 'manufacturerId',
			       foreignField: '_id',
			       as: 'manufacturer'
			    }
			},
			{
				$match :{
					$or : [
						{nameAr : { $regex: ".*(?i)" + string + ".*" }},
						{nameEn : { $regex: ".*(?i)" + string + ".*" }},
						{'manufacturer.nameEn' : { $regex: ".*(?i)" + string + ".*" }},
						{'manufacturer.nameAr' : { $regex: ".*(?i)" + string + ".*" }},
						{tagsIds : { $regex: ".*(?i)" + string + ".*" }},

					]
				}
			},
			{ $limit : limit},
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
				    "marketOfficialPrice":1,
				    "marketOfficialPrice":1,
				    "dockanBuyingPrice":1,
				    "availableTo":1,
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
			}
		);

		Products.getDataSource().connector.collection('products')
		.aggregate(stages,function(err,products){
	     	if(err)  
	     		return cb(err);
	     	return res.json(products)
	     });

	}

	Products.remoteMethod('search', {
		accepts: [
			{arg: 'string', type: 'string', 'http': {source: 'query'}},
			{arg: 'isOffer', type: 'string', 'http': {source: 'query'}},
			{arg: 'limit', type: 'number', 'http': {source: 'query'}},
			{arg: 'res', http: {source: 'res'}}
		],
		http: {verb: 'get',path: '/search'},
    });





	Products.exportProducts = function(res,cb){
		Products.find({/*where : {status : 'available'}*/},function(err,data){
			var config = {path : 'files/excelFiles',save : true,fileName : 'products'+Date.now()+'.xlsx'};
			model[0].access = 'id';
			mongoXlsx.mongoData2Xlsx(data, model,config, function(err, data) {
				console.log('File saved at:',path.join(__dirname ,'../../',data.fullPath),data.fullPath);
				return res.sendFile(path.join(__dirname ,'../../',data.fullPath))
			});
		});
	}


	Products.remoteMethod('exportProducts', {
    	description: 'export products to excel file',
		accepts: [
			{arg: 'res', http: {source: 'res'}}
		],
		http: {verb: 'post',path: '/exportProducts'},
    });




    Products.importProducts = function(fileUrl,res,cb){
		model[0].access = '_id';
		var fileName = path.basename(fileUrl);
		mongoXlsx.xlsx2MongoData(path.join(__dirname,'../../files/excelFiles',fileName),model,{},function(err,rows){
			if(err)
				return cb(err);
			var newRecords = [];

			var batch = Products.dataSource.adapter.collection('products').initializeUnorderedBulkOp();

			_.each(rows,function(row){
				try{row._id = Products.dataSource.ObjectID(row._id)}catch(e){row._id =  Products.dataSource.ObjectID()};
				if(row.manufacturerId) try {row.manufacturerId = Products.dataSource.ObjectID(row.manufacturerId)}catch(e){delete row.manufacturerId};
				if(row.categoryId) try {row.categoryId = Products.dataSource.ObjectID(row.categoryId)}catch(e){delete row.categoryId};
				if(row.subCategoryId) try {row.subCategoryId = Products.dataSource.ObjectID(row.subCategoryId)}catch(e){delete row.subCategoryId};
				if(row.tagsIds) try {row.tagsIds =JSON.parse(row.tagsIds)}catch(e){delete row.tagsIds};
				if(row.productsIds) try {row.productsIds =JSON.parse(row.productsIds)}catch(e){delete row.tagsIds};
				if(row.offersIds) try {row.offersIds =JSON.parse(row.offersIds)}catch(e){delete row.tagsIds};
	      		batch.find({_id:row._id}).upsert().updateOne(row);
			});
		    batch.execute(function(err, result) {
		    	if(err)
		    		return cb(err);
			    res.json({
			     	nMatched : result.nMatched,
			     	nInserted : result.nUpserted,
			     	nModified : result.nModified
			    })
		    });
		}) 
	}
	Products.remoteMethod('importProducts', {
    	description: 'import products from excel file',
		accepts: [
			{arg: 'fileUrl', type : 'string', description : 'url  file after uploaded on api/attachments/excelFiles/upload'},
			{arg: 'res', http: {source: 'res'}}
		],
		http: {verb: 'post',path: '/importProducts'},
    });
};



// for import/export Excel
var model = [
	{
	    displayName: "ID",
	    access: "_id",
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
	    displayName: "attachment url",
	    access: "media[url]",
	    type: "string"
    },
    {
	    displayName: "attachment thumbnail",
	    access: "media[thumbnail]",
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
	    displayName: "retail price / before offer",
	    access: "retailPrice",
	    type: "number"
    },
    {
	    displayName: "wholeSale price / before offer",
	    access: "wholeSalePrice",
	    type: "number"
    },
    {
    	displayName : "wholeSale market price",
    	access : "wholeSaleMarketPrice",
    	type : "number"
    },
    {
	    displayName: "market price",
	    access: "marketPrice",
	    type: "number"
    },
    {
	    displayName: "market official price",
	    access: "marketOfficialPrice",
	    type: "number"
    },
    {
	    displayName: "market actual price",
	    access: "marketActualPrice",
	    type: "number"
    },
    {
	    displayName: "dockan buying price",
	    access: "dockanBuyingPrice",
	    type: "number"
    },
    {
	    displayName: "retail Price discount / after offer",
	    access: "retailPriceDiscount",
	    type: "number"
    },
    {
	    displayName: "wholeSale Price Discount / after offer",
	    access: "wholeSalePriceDiscount",
	    type: "number"
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
	    displayName: "available to",
	    access: "availableTo",
	    type: "string"
    },
    {
	    displayName: "is Offer",
	    access: "isOffer",
	    type: "boolean"
    },
    {
	    displayName: "offer source",
	    access: "offerSource",
	    type: "string"
    },
    {
	    displayName: "offer max quantity",
	    access: "offerMaxQuantity",
	    type: "string"
    },
    {
	    displayName: "creation date",
	    access: "creationDate",
	    type: "Date"
    },
    {
	    displayName: "manufacturer ID",
	    access: "manufacturerId",
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
    {
	    displayName: "tags",
	    access: "tagsIds",
	    type: "General"
    },
    {
	    displayName: "products",
	    access: "productsIds",
	    type: "string"
    },
    {
	    displayName: "related Offers",
	    access: "offersIds",
	    type: "string"
    },
]