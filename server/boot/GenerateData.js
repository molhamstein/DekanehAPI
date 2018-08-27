'use strict';

module.exports = function GenerateData(server) {
	
// *****************************************************************************
	// return;
// *****************************************************************************
var area = [
	{"nameAr" : "ميدان", "nameEn" : "midan"},
	{"nameAr" : "زاهرة", "nameEn" : "Zahera"}
];


createData('area',area,function(err,areas){
	if(err)
		return console.log(err);
	server.models['user'].remove({"phoneNumber": "0936207611"},function(err,d){
		if(err)
			return console.log(err);
		var users = [
			{
			  "username": "ahmad ataya",
			  "email": "ahmad.3taya@gmail.com",
			  "password" : "qwe12345",
			  "status" : "activated",
			  "phoneNumber": "0936207611",
			  "gender": "male",
			  "ownerName" : "string",
			  "shopName": "shop name",
			  "locationPoint" : {
			  	"lat": 12,
			  	"lng": 12
			  },
			  "notes": "string",
			  "areaId" : areas[0].id.toString(),
			  "clientType" : "retailCostumer"
			},
			{
			  "username": "anaas",
			  "email": "anas.alazmeh@gmail.com",
			  "password" : "qwe12345",
			  "status" : "activated",
			  "phoneNumber": "09123456789",
			  "gender": "male",
			  "shopName": "shop name",
			  "ownerName" : "string",
			  "locationPoint" : {
			  	"lat": 12,
			  	"lng": 12
			  },
			  "notes": "string",
			  "areaId" : areas[1].id.toString(),
			  "clientType" : "wholesale"
			}
		]
		createData('user',users,function(err,users){
			if(err)
				return console.log(err);
			var categories = [
				{
				  "titleEn": "dietetics",
				  "titleAr": "غذائيات"
				}
			]
			createData('categories',categories,function(err,parentCategories){
				if(err)
					return console.log(err);

				var childCategories = [
					{
					  "titleEn": "mo3lbat",
					  "titleAr": "معلبات",
					  "parentCategoryId" : parentCategories[0].id.toString()
					}	
				];
				
				createData('categories',childCategories,function(err,childCategories){
					if(err)
						return console.log(err);

					var manufacturers = [
						{
						    "nameEn": "string",
						    "nameEn": "string"
						}
					];
					createData('manufacturers',manufacturers,function(err,manufacturers){
						if(err)
							return console.log(err);

						var Tags = [
							{
							    "nameEn": "tag1",
							    "nameEn": "tag1"
							},
							{
							    "nameEn": "tag2",
							    "nameEn": "tag2"
							},
							{
							    "nameEn": "tag3",
							    "nameEn": "tag3"
							}
						]	
						createData('tags',Tags,function(err,tags){
							if(err)
								return console.log(err);				

							var Products = [
								{
									"nameAr": "متبل",
								    "nameEn": "motabal",
								    "image": "104.217.253.15:3003/images/4e3bc962-e624-4826-aae7-e013983e31b2.png",
								    "pack": "string",
								    "description": "description",
								    "retailPrice": 100,
								    "wholeSalePrice": 200,
								    "wholeSaleMarketPrice": 300,
								    "marketPrice": 400,
								    "retailPriceDiscount": 95,
								    "wholeSalePriceDiscount": 195,
								    "isFeatured":true,
								    "status":"available",
								    "isOffer": false,
								    "categoryId": parentCategories[0].id.toString(),
								    "subCategoryId": childCategories[0].id.toString(),
								    "manufacturerId": manufacturers[0].id.toString(),
								    "tagsIds": [tags[0].id.toString(),tags[1].toString()]
								},
								{
									"nameAr": "لحم لانشون",
								    "nameEn": "luncheon meat",
								    "image": "104.217.253.15:3003/images/9f0806dd-d346-483c-bc80-2a4478b7f670.png",
								    "pack": "string",
								    "description": "description",
								    "retailPrice": 200,
								    "wholeSalePrice": 300,
								    "wholeSaleMarketPrice": 400,
								    "marketPrice": 500,
								    "retailPriceDiscount": 195,
								    "wholeSalePriceDiscount": 295,
								    "isFeatured":false,
								    "status":"available",
								    "isOffer": false,
								    "categoryId": parentCategories[0].id.toString(),
								    "manufacturerId": manufacturers[0].id.toString(),
								    "tagsIds": [tags[1].id.toString(),tags[2].toString()]
								}
							]

							createData('products',Products,function(err,products){
								if(err)
									return console.log(err);
								console.log("Done");
							});
						});

					});

				});
			});
		});
	});
});







	

	function createData(modelName,data,cb){
		var cb1 = function(err, records) {
			if (err)
				return console.log(err);
			console.log('Done seeding data, '+records.length+' records in '+modelName+' created.');
		};
		if(!cb)
			cb = cb1;
		server.models[modelName].create(data,cb);

	}
};
