'use strict';

var _ = require('lodash');
var notifications = require('../notifications');
module.exports = function (Orders) {
  Orders.validatesInclusionOf('status', { in: ['pending', 'inDelivery', 'delivered', 'canceled']
  });


  Orders.testNot = function (callback) {
    notifications.me();
    callback(null);
  };

  Orders.beforeRemote('prototype.updateAttributes', function (ctx, modelInstance, next) {
    console.log('upsert called');
    console.log(ctx.req.body);
    if (!ctx.req.accessToken || !ctx.req.accessToken.userId)
      return next(ERROR(403, 'User not login'))

    if (!ctx.req.body.orderProducts || !Array.isArray(ctx.req.body.orderProducts) || ctx.req.body.orderProducts.length == 0)
      return next(ERROR(400, 'products can\'t be empty', "PRODUCTS_REQUIRED"))
    var products = ctx.req.body.orderProducts;

    var productsIds = []
    _.each(products, product => {
      try {
        productsIds.push(Orders.dataSource.ObjectID(product.productId));
      } catch (e) {
        return next(ERROR(400, 'productId not ID'))
      }
    });

    Orders.app.models.user.findById(ctx.req.accessToken.userId, (err, user) => {
      if (err)
        return next(err);
      if (!user)
        return next(ERROR(400, 'user not found'));

      ctx.req.body.clientId = user.id;

      Orders.app.models.products.find({
        where: {
          id: {
            'in': productsIds
          }
        }
      }, function (err, productsFromDb) {
        if (err)
          return next(err);

        ctx.req.body.status = 'pending';
        ctx.req.body.clientType = user.clientType;
        ctx.req.body.totalPrice = 0;

        var productsInfo = {};
        _.each(productsFromDb, p => {
          productsInfo[p.id.toString()] = p;
        });
        var tempProduct = [];
        _.each(products, (product, index) => {
          var pInfo = productsInfo[product.productId];
          if (!pInfo)
            return delete products[index]
          if (pInfo.availableTo != user.clientType && pInfo.availableTo != 'both')
            return delete products[index]

          product.nameEn = pInfo.nameEn;
          product.nameAr = pInfo.nameAr;
          product.pack = pInfo.pack;
          product.description = pInfo.description;
          product.marketOfficialPrice = pInfo.marketOfficialPrice;
          product.dockanBuyingPrice = pInfo.dockanBuyingPrice;
          product.wholeSaleMarketPrice = pInfo.wholeSaleMarketPrice;
          product.horecaPriceDiscount = pInfo.horecaPriceDiscount;
          product.wholeSalePriceDiscount = pInfo.wholeSalePriceDiscount;
          product.horecaPrice = pInfo.horecaPrice;
          product.wholeSalePrice = pInfo.wholeSalePrice;
          product.offerSource = pInfo.offerSource;
          product.media = pInfo.media;
          if (user.clientType == 'wholesale') {
            product.price = (pInfo.wholeSalePriceDiscount && pInfo.wholeSalePriceDiscount) == 0 ? pInfo.wholeSalePrice : pInfo.wholeSalePriceDiscount;
          } else {
            product.price = (pInfo.horecaPriceDiscount && pInfo.horecaPriceDiscount) == 0 ? pInfo.horecaPrice : pInfo.horecaPriceDiscount;
          }
          ctx.req.body.totalPrice += Number(product.count) * Number(product.price);
          product.isOffer = pInfo.isOffer;
          if (pInfo.isOffer && pInfo.products) {
            product.products = JSON.parse(JSON.stringify(pInfo.products()));
          }
          tempProduct.push(product)
        });
        console.log(ctx.req.body.totalPrice)
        if (ctx.req.body.totalPrice < 20000)
          return next(ERROR(602, 'total price is low'));
        ctx.req.body.tempProduct = tempProduct

        if (!ctx.req.body.couponCode)
          return next();

        Orders.app.models.coupons.findOne({
          where: {
            code: ctx.req.body.couponCode,
            expireDate: {
              gte: new Date()
            },
            userId: user.id
          }
        }, function (err, coupon) {
          if (err)
            return next(err);
          if (!coupon)
            return next(ERROR(400, 'coupon not found or expired date', 'COUPON_NOT_FOUND'));
          if (coupon.numberOfUsed >= coupon.numberOfTimes || coupon.status == 'used')
            return next(ERROR(400, 'coupon used for all times', 'COUPON_NOT_AVAILABLE'));

          ctx.req.body.couponId = coupon.id;
          ctx.req.body.priceBeforeCoupon = ctx.req.body.totalPrice;
          if (coupon.type == 'fixed') {
            ctx.req.body.totalPrice -= coupon.value;
          } else {
            ctx.req.body.totalPrice -= ((ctx.req.body.totalPrice * coupon.value) / 100)
          }

          // edit coupon
          coupon.numberOfUsed++;
          if (coupon.numberOfUsed == coupon.numberOfTimes)
            coupon.status = 'used';
          coupon.save(function (err) {
            if (err)
              return next(err);
            return next();
          });
        });
      });
    });
  })

  Orders.afterRemote('prototype.updateAttributes', function (ctx, result, next) {
    Orders.app.models.orderProducts.destroyAll({
        "orderId": result.id
      },
      function (err, isDelete) {
        if (err)
          return next(err)
        console.log(err)
        _.each(result.tempProduct, oneProduct => {
          oneProduct.orderId = result.id;
        })
        Orders.app.models.orderProducts.create(result.tempProduct, function (err, data) {
          if (err)
            return next(err)
          result.tempProduct = null;
          result.code = result.id.toString().slice(18);
          return result.save(next);
        })
      })
  })
  Orders.beforeRemote('create', function (ctx, modelInstance, next) {
    if (!ctx.req.accessToken || !ctx.req.accessToken.userId)
      return next(ERROR(403, 'User not login'))

    if (!ctx.req.body.orderProducts || !Array.isArray(ctx.req.body.orderProducts) || ctx.req.body.orderProducts.length == 0)
      return next(ERROR(400, 'products can\'t be empty', "PRODUCTS_REQUIRED"))
    var products = ctx.req.body.orderProducts;


    var productsIds = []
    _.each(products, product => {
      try {
        productsIds.push(Orders.dataSource.ObjectID(product.productId));
      } catch (e) {
        return next(ERROR(400, 'productId not ID'))
      }
    });
    console.log("productsIds")
    console.log(productsIds)

    Orders.app.models.user.findById(ctx.req.accessToken.userId, (err, user) => {
      if (err)
        return next(err);
      if (!user)
        return next(ERROR(400, 'user not found'));

      ctx.req.body.clientId = user.id;

      Orders.app.models.products.find({
        where: {
          id: {
            'in': productsIds
          }
        }
      }, function (err, productsFromDb) {
        if (err)
          return next(err);
        console.log("productsFromDb")
        console.log(productsFromDb)

        ctx.req.body.status = 'pending';
        ctx.req.body.clientType = user.clientType;
        ctx.req.body.totalPrice = 0;

        var productsInfo = {};
        _.each(productsFromDb, p => {
          productsInfo[p.id.toString()] = p;
        });

        _.each(products, (product, index) => {
          var pInfo = productsInfo[product.productId];
          if (!pInfo)
            return delete products[index]
          if (pInfo.availableTo != user.clientType && pInfo.availableTo != 'both')
            return delete products[index]
          product.nameEn = pInfo.nameEn;
          product.nameAr = pInfo.nameAr;
          product.pack = pInfo.pack;
          product.description = pInfo.description;
          product.marketOfficialPrice = pInfo.marketOfficialPrice;
          product.dockanBuyingPrice = pInfo.dockanBuyingPrice;
          product.wholeSaleMarketPrice = pInfo.wholeSaleMarketPrice;
          product.horecaPriceDiscount = pInfo.horecaPriceDiscount;
          product.wholeSalePriceDiscount = pInfo.wholeSalePriceDiscount;
          product.horecaPrice = pInfo.horecaPrice;
          product.wholeSalePrice = pInfo.wholeSalePrice;
          product.offerSource = pInfo.offerSource;



          product.media = pInfo.media;
          if (user.clientType == 'wholesale') {
            product.price = (pInfo.wholeSalePriceDiscount && pInfo.wholeSalePriceDiscount) == 0 ? pInfo.wholeSalePrice : pInfo.wholeSalePriceDiscount;
          } else {
            product.price = (pInfo.horecaPriceDiscount && pInfo.horecaPriceDiscount) == 0 ? pInfo.horecaPrice : pInfo.horecaPriceDiscount;
          }
          ctx.req.body.totalPrice += Number(product.count) * Number(product.price);
          product.isOffer = pInfo.isOffer;
          if (pInfo.isOffer && pInfo.products) {
            product.products = JSON.parse(JSON.stringify(pInfo.products()));
          }
        });
        console.log(ctx.req.body.totalPrice)
        if (ctx.req.body.totalPrice < 20000)
          return next(ERROR(602, 'total price is low'));

        if (!ctx.req.body.couponCode)
          return next();

        Orders.app.models.coupons.findOne({
          where: {
            code: ctx.req.body.couponCode,
            expireDate: {
              gte: new Date()
            },
            userId: user.id
          }
        }, function (err, coupon) {
          if (err)
            return next(err);
          if (!coupon)
            return next(ERROR(400, 'coupon not found or expired date', 'COUPON_NOT_FOUND'));
          if (coupon.numberOfUsed >= coupon.numberOfTimes || coupon.status == 'used')
            return next(ERROR(400, 'coupon used for all times', 'COUPON_NOT_AVAILABLE'));

          ctx.req.body.couponId = coupon.id;
          ctx.req.body.priceBeforeCoupon = ctx.req.body.totalPrice;
          if (coupon.type == 'fixed') {
            ctx.req.body.totalPrice -= coupon.value;
          } else {
            ctx.req.body.totalPrice -= ((ctx.req.body.totalPrice * coupon.value) / 100)
          }

          // edit coupon
          coupon.numberOfUsed++;
          if (coupon.numberOfUsed == coupon.numberOfTimes)
            coupon.status = 'used';
          coupon.save(function (err) {
            if (err)
              return next(err);
            return next();
          });
        });
      });
    });
  });

  Orders.afterRemote('create', function (ctx, result, next) {
    result.orderProducts(function (err, data) {
      _.each(data, oneProduct => {
        oneProduct.orderId = result.id;
      })
      Orders.app.models.orderProducts.create(data, function (err, data) {
        if (err)
          return next(err)
        result['products'] = null;
        //   result.orderProducts=data;
        Orders.app.models.notification.create({
          "type": "order",
          "orderId": result.id
        }, function (err, data) {
          if (err)
            return next(err)
          result.code = result.id.toString().slice(18);
          return result.save(next);
        })

      })
    })
  });


  Orders.assignOrderToDelivery = function (orderId, userId, cb) {
    Orders.app.models.user.findById(userId, function (err, user) {
      if (err)
        return cb(err);
      if (!user) {
        return cb(ERROR(404, 'user not found'));
      }
      if (!user.hasPrivilege('userDelivery'))
        return cb(ERROR(400, 'user not delivery'));

      Orders.findById(orderId, function (err, order) {
        if (err)
          return cb(err);
        if (!order)
          return cb(ERROR(404, 'order not found'));
        if (order.status != 'pending')
          return cb(ERROR(400, 'order already in delivery'));

        order.status = 'inDelivery';
        order.deliveryMemberId = userId;
        order.assignedDate = new Date();
        order.save((err) => {
          // TODO : send Notification to user delivery 
          return cb(null, 'order is assigned');
        })

      });

    });
  }
  Orders.remoteMethod('assignOrderToDelivery', {
    accepts: [{
      arg: 'orderId',
      type: 'string',
      required: true
    }, {
      arg: 'userId',
      type: 'string',
      required: true
    }],
    returns: {
      arg: 'message',
      type: 'string'
    },
    http: {
      verb: 'post',
      path: '/:orderId/assignDelivery'
    },
  });


  /**
   *
   * @param {string} result
   * @param {Function(Error, array)} callback
   */

  Orders.supplierOrders = function (result, callback) {
    var result;
    // TODO
    callback(null, result);
  };

  Orders.changeStatusOrderToDeliverd = function (req, orderId, cb) {
    if (!req.user)
      return cb(ERROR(403, 'user not login'));

    Orders.findById(orderId, function (err, order) {
      if (err)
        return cb(err);
      if (!order)
        return cb(ERROR(404, 'order not found'));

      if (order.status != 'inDelivery')
        return cb(ERROR(400, 'order not in delivery'));

      // TODO : or admin can edit order status to delivered
      // if(order.deliveryMemberId != req.user.id.toString())
      // 	return cb(ERROR (500,'not privilege to this order'));

      order.status = 'delivered';
      order.deliveredDate = new Date();
      order.save((err) => {
        // TODO : send Notification to client for rate this order 
        cb(null, 'order is delivered');
        notifications.afterOrderDelivered(order);
      })

    });

  }

  Orders.remoteMethod('changeStatusOrderToDeliverd', {
    accepts: [{
      arg: 'req',
      http: {
        source: 'req'
      }
    }, {
      arg: 'orderId',
      type: 'string',
      required: true
    }],
    returns: {
      arg: 'message',
      type: 'string'
    },
    http: {
      verb: 'post',
      path: '/:orderId/delivered'
    },
  });

  /**
   *
   * @param {Function(Error, array)} callback
   */

  Orders.supplierOrders = function (callback) {
    var result;
    var newDate = new Date();
    newDate.setHours(0);
    Orders.find({
      where: {
        status: "pending"
      }
    }, function (err, data) {
      // return callback(err, data);
      var products = {};
      var total = 0;
      data.forEach(function (elementOrder, indexOrd) {
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
                    wholeSalePrice: element.wholeSalePrice,
                    id: element.id
                  }
                };
              }
              total += parseFloat(element.dockanBuyingPrice) * parseFloat(element.count);
              products[element.productId].count += parseFloat(element.count);
              products[element.productId].price += parseFloat(element.dockanBuyingPrice) * parseFloat(element.count);
              if (indexOrd == data.length - 1 && indexProd == orderdata.length - 1) {
                _toArray(products, function (arrayData) {
                  return callback(null, {
                    total: total,
                    data: arrayData
                  });
                })
              }
            }, this);
          } else if (indexOrd == data.length - 1) {
            _toArray(products, function (arrayData) {
              return callback(null, {
                total: total,
                data: arrayData
              });
            })
          }
        })
      }, this);
    })
  };

  function _toArray(data, cb) {
    var result = [];
    console.log("data");
    for (var key in data) {

      result.push(data[key]);
    }
    cb(result);
  }
};

// var ERROR = function(statusCode,message,code){
// 	var err = new Error(message);
// 	err.statusCode = statusCode;
// 	err.code = code || (message.replace(/ /g, '_').toUpperCase());
// 	return err;
// }
