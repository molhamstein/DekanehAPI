'use strict';
var _ = require('lodash')
module.exports = function (Ordersfromsuppliers) {

  Ordersfromsuppliers.validatesInclusionOf('status', { in: ['pending', 'cashed']
  })

  // past fllow to add Ordersfromsuppliers by ahmad

  // Ordersfromsuppliers.beforeRemote('create', function(ctx, modelInstance, next) {
  // 	if(!ctx.req.body.products || !Array.isArray(ctx.req.body.products) || ctx.req.body.products.length == 0)
  // 		return next(ERROR(400,'products required'));

  // 	var products = ctx.req.body.products;
  // 	var productsIds = []
  // 	_.each(products,product =>{
  // 		try{
  // 			productsIds.push(Ordersfromsuppliers.dataSource.ObjectID(product.productId));
  // 		}catch(e){
  // 			return next(ERROR(400,'productId '+ product.productId +' must be ID','PRODUCTID_NOT_ID'))
  // 		}
  // 	});
  // 	console.log(productsIds)
  // 	Ordersfromsuppliers.app.models.products.find({where : {id : {'in' : productsIds}}},function(err,productsFromDb){
  // 		if(err)
  // 			return next(err);
  // 		var productsInfo = {};
  // 		_.each(productsFromDb,p=>{
  // 			productsInfo[p.id.toString()] = p; 
  // 		});

  // 		ctx.req.body.totalPrice = 0;
  // 		ctx.req.body.staffId = ctx.req.accessToken.userId;
  // 		_.each(products,product => {
  // 			var pInfo  = productsInfo[product.productId];
  // 			if(!pInfo)
  // 				return;
  // 			product.nameEn = pInfo.nameEn; 
  // 			product.nameAr = pInfo.nameAr;
  // 			ctx.req.body.totalPrice += Number(product.count) * Number(product.price);
  // 		});
  // 		return next();
  // 	});
  // });

  Ordersfromsuppliers.beforeRemote('create', function (ctx, modelInstance, next) {

    Ordersfromsuppliers.app.models.Suppliers.find({}, function (err, data) {
      if (err)
        return next(err)
      ctx.req.body.staffId = ctx.req.accessToken.userId;
      ctx.req.body.supplierId = data[0].id
      Ordersfromsuppliers.findOne({
        "order": "creationDate DESC"
      }, function (err, oneOrderFromSupplier) {
        if (err)
          return next(err, null)

        Ordersfromsuppliers.app.models.Orders.find({
          where: {
            and: [{
                status: "pending"
              },
              {
                orderDate: {
                  "gt": oneOrderFromSupplier.creationDate
                }
              }
            ]
          }
        }, function (err, data) {
          var products = {};
          var total = 0;
          var orderIds = [];
          if (data.length > 0)
            data.forEach(function (elementOrder, indexOrd) {
              orderIds.push(elementOrder.id);
              elementOrder.orderProducts(function (err, orderdata) {
                if (orderdata.length != 0) {
                  orderdata.forEach(function (element, indexProd) {
                    if (products[element.productId] == null) {
                      products[element.productId] = {
                        count: 0,
                        price: 0,
                        product: {
                          media: element.media,
                          nameEn: element.nameEn,
                          nameAr: element.nameAr,
                          pack: element.pack,
                          description: element.description,
                          marketOfficialPrice: element.marketOfficialPrice,
                          dockanBuyingPrice: element.dockanBuyingPrice,
                          wholeSaleMarketPrice: element.wholeSaleMarketPrice,
                          horecaPriceDiscount: element.horecaPriceDiscount,
                          wholeSalePriceDiscount: element.wholeSalePriceDiscount,
                          horecaPrice: element.horecaPrice,
                          wholeSalePrice: element.wholeSalePrice
                        }
                      };
                    }
                    total += parseFloat(element.dockanBuyingPrice) * parseFloat(element.count);
                    products[element.productId].count += parseFloat(element.count);
                    products[element.productId].price += parseFloat(element.dockanBuyingPrice) * parseFloat(element.count);
                    if (indexOrd == data.length - 1 && indexProd == orderdata.length - 1) {
                      _toArray(products, function (arrayData) {
                        ctx.req.body.total = total;
                        ctx.req.body.products = arrayData;
                        ctx.req.body.orders = orderIds;
                        console.log(ctx.req.body)
                        next()
                      })
                    }
                  }, this);
                } else if (indexOrd == data.length - 1) {
                  _toArray(products, function (arrayData) {
                    ctx.req.body.total = total;
                    ctx.req.body.products = arrayData;
                    ctx.req.body.orders = orderIds;
                    console.log(ctx.req.body)
                    next()

                  })
                }
              })
            }, this);
          else {
            return next(ERROR(609, 'no order pinding'))
          }
        })
      })
    })
  })

  function _toArray(data, cb) {
    var result = [];
    for (var key in data) {

      result.push(data[key]);
    }
    cb(result);
  }

};
