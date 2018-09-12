'use strict';

module.exports = function GenerateData(server) {
	
// *****************************************************************************
	// return;
// *****************************************************************************
var area = [
	{"nameAr" : "ميدان", "nameEn" : "midan"},
	{"nameAr" : "زاهرة", "nameEn" : "Zahera"}
];
var topSlider = [
	{"image": "https://images.pexels.com/photos/104827/cat-pet-animal-domestic-104827.jpeg?auto=compress&cs=tinysrgb&h=350","type": "external"},
	{"image": "http://104.217.253.15:3003/images/4e3bc962-e624-4826-aae7-e013983e31b2.png","target" : "5b86581e5404f62e708d9bee","type": "product"},
	{"image": "http://104.217.253.15:3003/images/9f0806dd-d346-483c-bc80-2a4478b7f670.png","target" : "5b86581e5404f62e708d9bef","type": "product"},
	{"image": "https://images.pexels.com/photos/104827/cat-pet-animal-domestic-104827.jpeg?auto=compress&cs=tinysrgb&h=350","type": "external"}
];
var suppliers = [
	{"id" : "5b8fa87b917cd61848e3d56b", "titleEn" : "supplier1", "titleAr" : "مورد 1"},
	{"id" : "5b8fa87c917cd61848e3d56c", "titleEn" : "supplier2", "titleAr" : "مورد 2"},
	{"id" : "5b8fa87d917cd61848e3d56d", "titleEn" : "supplier3", "titleAr" : "مورد 3"}
];

createData('area',area,function(err,areas){
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
			},
			{
			  "titleEn": "category 2",
			  "titleAr": "category 2"
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
				},
				{
				  "titleEn": "sardines",
				  "titleAr": "سردين",
				  "parentCategoryId" : parentCategories[1].id.toString()
				},
				{
				  "titleEn": "Toon",
				  "titleAr": "طون",
				  "parentCategoryId" : parentCategories[1].id.toString()
				}	
			];
			
			createData('categories',childCategories,function(err,childCategories){
				if(err)
					return console.log(err);

				var manufacturers = [
					{
					    "nameEn": "Al Duraa",
					    "nameAr": "الدرة"
					},
					{
					    "nameEn": "Delta",
					    "nameAr": "دلتا"
					},
					{
					    "nameEn": "Al Burj",
					    "nameAr": "البرج"
					},
					{
					    "nameEn": "Bassmeh",
					    "nameAr": "بسمة"
					},
					{
					    "nameEn": "Bustan",
					    "nameAr": "البستان"
					}
				];
				createData('manufacturers',manufacturers,function(err,manufacturers){
					if(err)
						return console.log(err);

					var Tags = [
						{
						    "nameEn": "tag1",
						    "nameAr": "tag1"
						},
						{
						    "nameEn": "tag2",
						    "nameAr": "tag2"
						},
						{
						    "nameEn": "tag3",
						    "nameAr": "tag3"
						}
					]	
					createData('tags',Tags,function(err,tags){
						if(err)
							return console.log(err);				

						var Products = [
							{
								"id" :"5b86581e5404f62e708d9bee",
								"nameAr": "متبل",
							    "nameEn": "motabal",
							    "image": "http://104.217.253.15:3003/images/4e3bc962-e624-4826-aae7-e013983e31b2.png",
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
							    "manufacturerId": manufacturers[1].id.toString(),
							    "tagsIds": [tags[0].id.toString(),tags[1].id.toString()]
							},
							{
							    "id": "5b86581e5404f62e708d9bef",
								"nameAr": "لحم لانشون",
							    "nameEn": "luncheon meat",
							    "image": "http://104.217.253.15:3003/images/9f0806dd-d346-483c-bc80-2a4478b7f670.png",
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
							    "manufacturerId": manufacturers[3].id.toString(),
							    "tagsIds": [tags[1].id.toString(),tags[2].id.toString()]
							},
							{
							    "id": "5b86581e5404f62e708d9bf0",
								"nameAr": "حلاوة  البرج",
							    "nameEn": "halawa al burj",
							    "image": "http://104.217.253.15:3003/images/d896dd06-9c07-4652-88af-6ec802ea0a80.png",
							    "pack": "string",
							    "description": "description",
							    "retailPrice": 25,
							    "wholeSalePrice": 50,
							    "wholeSaleMarketPrice": 60,
							    "marketPrice": 70,
							    "isFeatured":true,
							    "status":"available",
							    "isOffer": false,
							    "categoryId": parentCategories[0].id.toString(),
							    "manufacturerId": manufacturers[2].id.toString(),
							    "tagsIds": [tags[0].id.toString(),tags[2].id.toString()],
							    "offersIds" : ["5b864fcb35b3599cebaa7519"]
							},
							{
							    "id": "5b86581e5404f62e708d9bf1",
								"nameAr": "حلاوة الرفاعي بالفستق الحلبي",
							    "nameEn": "halawa al refai",
							    "image": "http://104.217.253.15:3003/images/a82f13e7-af3e-4d1b-b4c6-235e5122c341.png",
							    "pack": "string",
							    "description": "description description description description description description description ",
							    "retailPrice": 25,
							    "wholeSalePrice": 50,
							    "wholeSaleMarketPrice": 60,
							    "marketPrice": 70,
							    "isFeatured":false,
							    "status":"available",
							    "isOffer": false,
							    "categoryId": parentCategories[0].id.toString(),
							    "subCategoryId": childCategories[0].id.toString(),
							    "manufacturerId": manufacturers[0].id.toString(),
							    "tagsIds": [tags[0].id.toString(),tags[2].id.toString()]
							},
							{
								"id": "5b86581e5404f62e708d9bf2",
								"nameAr": "مخلل خيار",
							    "nameEn": "pickled cueumber",
							    "image": "http://104.217.253.15:3003/images/abc95393-e9ce-429c-96e3-22d549cda58b.png",
							    "pack": "string",
							    "description": "description description description description description description description ",
							    "retailPrice": 1000,
							    "wholeSalePrice": 1100,
							    "wholeSaleMarketPrice": 1300,
							    "marketPrice": 1700,
							    "isFeatured":false,
							    "status":"available",
							    "isOffer": false,
							    "categoryId": parentCategories[0].id.toString(),
							    "manufacturerId": manufacturers[4].id.toString(),
							    "tagsIds": [],
							    "offersIds" : ["5b8650bb35b3599cebaa751a"]
							},
							{
								"id": "5b86581e5404f62e708d9bf3",
								"nameAr": "زيتون محشي فليفلة",
							    "nameEn": "olives stuffed pepper",
							    "image": "http://104.217.253.15:3003/images/787b6b22-2be0-4a9d-9757-4f17ad5eb242.png",
							    "pack": "string",
							    "description": "description description description description description description description ",
							    "retailPrice": 1000,
							    "wholeSalePrice": 1100,
							    "wholeSaleMarketPrice": 1300,
							    "marketPrice": 1700,
							    "isFeatured":false,
							    "status":"available",
							    "isOffer": false,
							    "categoryId": parentCategories[0].id.toString(),
							    "manufacturerId": manufacturers[4].id.toString(),
							    "tagsIds": [tags[0].id.toString()],
							    "offersIds" : ["5b8650bb35b3599cebaa751a"]
							},
							{
							    "id": "5b86581e5404f62e708d9bf4",
								"nameAr": "سردين",
							    "nameEn": "sardines",
							    "image": "http://104.217.253.15:3003/images/cf942b5d-aa85-40cc-aed8-64d7fee9a7bb.png",
							    "pack": "string",
							    "description": "description description description description description description description ",
							    "retailPrice": 1000,
							    "wholeSalePrice": 1100,
							    "wholeSaleMarketPrice": 1300,
							    "marketPrice": 1700,
							    "isFeatured":false,
							    "status":"available",
							    "isOffer": false,
							    "categoryId": parentCategories[1].id.toString(),
							    "subCategoryId": childCategories[1].id.toString(),
							    "manufacturerId": manufacturers[0].id.toString(),
							    "tagsIds": [tags[0].id.toString(),tags[1].id.toString(),tags[2].id.toString()]
							},
							{
							    "id": "5b86581e5404f62e708d9bf5",
								"nameAr": "طون",
							    "nameEn": "chicken luncheon meat",
							    "image": "http://104.217.253.15:3003/images/9fcef387-0724-4eb5-b63a-0d4c252e65a6.png",
							    "pack": "string",
							    "description": "description description description description description description description ",
							    "retailPrice": 1000,
							    "wholeSalePrice": 1100,
							    "retailPriceDiscount": 950,
							    "wholeSalePriceDiscount": 1000,
							    "wholeSaleMarketPrice": 1300,
							    "marketPrice": 1700,
							    "isFeatured":false,
							    "status":"available",
							    "isOffer": false,
							    "categoryId": parentCategories[1].id.toString(),
							    "subCategoryId": childCategories[2].id.toString(),
							    "manufacturerId": manufacturers[0].id.toString(),
							    "tagsIds": [tags[0].id.toString(),tags[1].id.toString(),tags[2].id.toString()]
							},
							{
							    "id": "5b86581e5404f62e708d9bf6",
								"nameAr": "طحينة",
							    "nameEn": "tahini",
							    "image": "http://104.217.253.15:3003/images/8f0063bc-ff30-4060-ac0c-4a659f3bd16f.png",
							    "pack": "string",
							    "description": "description description description description description description description ",
							    "retailPrice": 1000,
							    "wholeSalePrice": 1100,
							    "wholeSaleMarketPrice": 1300,
							    "marketPrice": 1700,
							    "isFeatured":false,
							    "status":"available",
							    "isOffer": false,
							    "categoryId": parentCategories[0].id.toString(),
							    "manufacturerId": manufacturers[2].id.toString(),
							    "tagsIds": [tags[1].id.toString(),tags[2].id.toString()],
							    "offersIds"  :["5b864fcb35b3599cebaa7519"]
							},
							{
							    "id": "5b86581e5404f62e708d9bf7",
								"nameAr": "مربى المشمش",
							    "nameEn": "apricot jam",
							    "image": "http://104.217.253.15:3003/images/60510596-ffdb-4a19-ad59-6903686efe54.png",
							    "pack": "string",
							    "description": "description description description description description description description ",
							    "retailPrice": 1000,
							    "wholeSalePrice": 1100,
							    "wholeSaleMarketPrice": 1300,
							    "marketPrice": 1700,
							    "isFeatured":false,
							    "status":"available",
							    "isOffer": false,
							    "categoryId": parentCategories[0].id.toString(),
							    "manufacturerId": manufacturers[0].id.toString(),
							    "tagsIds": [tags[1].id.toString(),tags[2].id.toString()]
							},
							{
							    "id": "5b86581e5404f62e708d9bf8",
								"nameAr": "ماء الزهر",
							    "nameEn": "flower water",
							    "image": "http://104.217.253.15:3003/images/36688068-8adb-49f6-98bf-7448d60c834c.png",
							    "pack": "string",
							    "description": "description description description description description description description ",
							    "retailPrice": 1000,
							    "wholeSalePrice": 1100,
							     "retailPriceDiscount": 900,
							    "wholeSalePriceDiscount": 975,
							    "wholeSaleMarketPrice": 1300,
							    "marketPrice": 1700,
							    "isFeatured":false,
							    "status":"available",
							    "isOffer": false,
							    "categoryId": parentCategories[0].id.toString(),
							    "manufacturerId": manufacturers[0].id.toString(),
							    "tagsIds": [tags[1].id.toString(),tags[2].id.toString()]
							},
							{
							    "id": "5b864fcb35b3599cebaa7519",
							    "nameAr": "offer1",
							    "nameEn": "offer1",
							    "description": "string string string string string string string string string string string string ",
							    "retailPrice": 2000,
							    "wholeSalePrice": 2200,
							    "wholeSaleMarketPrice": 2500,
							    "retailPriceDiscount": 1800,
							    "wholeSalePriceDiscount": 2000,
							    "isFeatured": true,
							    "status": "available",
							    "isOffer": true,
							    "categoryId": parentCategories[0].id.toString(),
							    "productsIds": [
							      "5b86581e5404f62e708d9bf6",
							      "5b86581e5404f62e708d9bf0"
							    ],
							    "tagsIds": [],
							    "manufacturerId": manufacturers[2].id.toString(),
							},
							{
							    "id": "5b8650bb35b3599cebaa751a",
							    "nameAr": "offer2",
							    "nameEn": "offer2",
							    "description": "string string string string string string string string string string string string ",
							    "retailPrice": 1500,
							    "wholeSalePrice": 1600,
							    "wholeSaleMarketPrice": 1800,
							    "retailPriceDiscount": 1400,
							    "wholeSalePriceDiscount": 1500,
							    "isFeatured": false,
							    "status": "available",
							    "isOffer": true,
							    "categoryId": parentCategories[0].id.toString(),
							    "offersIds": [],
							    "tagsIds": [],
							    "productsIds": [
							      "5b86581e5404f62e708d9bf2",
							      "5b86581e5404f62e708d9bf3"
							    ],
							    "manufacturerId": manufacturers[4].id.toString()
							  }
						]

						createData('products',Products,function(err,products){
							if(err)
								return console.log(err);
							createData('topSlider',topSlider,function(err,topSliders){
								if(err)
									return console.log(err);
								var ordersFromSuppliers = [
									{
										"staffId" : users[0].id.toString(),
										"supplierId" : "5b8fa87b917cd61848e3d56b",
										"products": [
										    {"count": 1,"price": 100 ,"nameAr": "متبل","nameEn": "motabal","productId": "5b86581e5404f62e708d9bee"},
										    {"count": 2,"price": 200 ,"nameAr": "لحم لانشون","nameEn": "luncheon meat","productId": "5b86581e5404f62e708d9bef"},
										    {"count": 24,"price": 800 ,"nameAr": "زيتون محشي فليفلة","nameEn": "olives stuffed pepper","productId": "5b86581e5404f62e708d9bf3"},
										    {"count": 9,"price": 450 ,"nameAr": "سردين","nameEn": "sardines","productId": "5b86581e5404f62e708d9bf4"},
										    {"count": 5,"price": 900 ,"nameAr": "طون","nameEn": "chicken luncheon meat","productId": "5b86581e5404f62e708d9bf5"},
										    {"count": 1,"price": 1150 ,"nameAr": "طحينة","nameEn": "tahini","productId": "5b86581e5404f62e708d9bf6"}
										],
										"totalPrice" : 	29400
									},
									{
										"staffId" : users[1].id.toString(),
										"supplierId" : "5b8fa87c917cd61848e3d56c",
										"products": [
										    {"count": 5,"price": 1000,"nameAr": "حلاوة  البرج", "nameEn": "halawa al burj","productId": "5b86581e5404f62e708d9bf0"},
										    {"count": 10,"price": 350,"nameAr": "حلاوة الرفاعي بالفستق الحلبي", "nameEn": "halawa al refai","productId": "5b86581e5404f62e708d9bf1"},
										    {"count": 3,"price": 600 ,"nameAr": "مخلل خيار", "nameEn": "pickled cueumber","productId": "5b86581e5404f62e708d9bf2"}
										],
										"totalPrice" : 	10300
									},
									{
										"staffId" : users[0].id.toString(),
										"supplierId" : "5b8fa87d917cd61848e3d56d",
										"products": [
										    {"count": 1,"price": 1000,"nameAr": "حلاوة  البرج", "nameEn": "halawa al burj","productId": "5b86581e5404f62e708d9bf0"},
										    {"count": 2,"price": 200 ,"nameAr": "لحم لانشون","nameEn": "luncheon meat","productId": "5b86581e5404f62e708d9bef"},
										    {"count": 3,"price": 750 ,"nameAr": "ماء الزهر", "nameEn": "flower water","productId": "5b86581e5404f62e708d9bf8"}
										],
										"totalPrice" : 	3650
									},
								];

								createData('suppliers',suppliers,function(err,Suppliers){
									if(err)
										return console.log(err);
									createData('ordersFromSuppliers',ordersFromSuppliers,function(err,ordersFromSuppliers){
										if(err)
											return console.log(err);
										console.log("Done");
									});
								});
							});
						});
					});

				});

			},{notDelete : true});
		});
	});
});







	

	function createData(modelName,data,cb,option={}){
		var cb1 = function(err, records) {
			if (err)
				return console.log(err);
			console.log('Done seeding data, '+records.length+' records in '+modelName+' created.');
		};
		if(!cb)
			cb = cb1;
		if(!option.notDelete){
			server.models[modelName].remove({},function(err,d){
				server.models[modelName].create(data,cb);
			});
		}
		else{
			server.models[modelName].create(data,cb);
		}

	}
};


// var offers = {
//   "nameAr": "offer1",
//   "nameEn": "offer1",
//   "description": "string string string string string string string string string string string string ",
//   "retailPrice": 2000,
//   "wholeSalePrice": 2200,
//   "retailPriceDiscount": 1800,
//   "wholeSalePriceDiscount": 2000,
//   "isFeatured": true,
//   "status": "available",
//   "isOffer": true,
//   "categoryId": ,
//   "productsIds": [
    
//   ],
//   "manufacturerId": 

// }
