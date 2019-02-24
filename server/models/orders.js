'use strict';

var _ = require('lodash');
const ejs = require('ejs');
const path = require('path');

var fs = require('fs');
var pdf = require('html-pdf');
var html = fs.readFileSync('lecture_text.html', 'utf8');
var myConfig = require('../myConfig');


// var html = "<div>هااااااااي</div>";
var options = {
  format: 'A4',
  border: {
    "top": "40px", // default is 0, units: mm, cm, in, px
    "right": "0in",
    "bottom": "40px",
    "left": "0in"
  },
};

var notifications = require('../notifications');
module.exports = function (Orders) {
  Orders.validatesInclusionOf('status', {
    in: ['pending', 'inDelivery', 'delivered', 'canceled']
  });




  Orders.printInvoice = function (id, callback) {
    Orders.findById(id, function (err, data) {
      if (err)
        callback(err)
      var name = new Date().getTime() + ".pdf"
      // console.log("owner name");
      // console.log(JSON.parse(JSON.stringify(data.client())).ownerName);
      // console.log("owner phoneNumber");
      // console.log(JSON.parse(JSON.stringify(data.client())).phoneNumber);
      // console.log("order date");
      // console.log(data.orderDate.getDate() + "/" + (data.orderDate.getMonth() + 1) + "/" + data.orderDate.getFullYear());
      var userType = ""
      if (data.clientType == "wholesale")
        userType = "الصفة التجارية للمبيع : لمحل جملة";
      else
        userType = "الصفة التجارية للمبيع : لمحل مفرق";


      var firstMainProduct = [];
      var secondeMainProduct = [];
      var orderProducts = JSON.parse(JSON.stringify(data.orderProducts()));
      // console.log("products")
      for (let index = 0; index < orderProducts.length; index++) {
        const element = orderProducts[index];
        if (index < 17)
          firstMainProduct.push({
            "index": index + 1,
            "price": element.price,
            "nameAr": element.nameAr,
            "count": element.count,
            "marketOfficialPrice": element.marketOfficialPrice
          })
        else {
          secondeMainProduct.push({
            "index": index + 1,
            "price": element.price,
            "nameAr": element.nameAr,
            "count": element.count,
            "marketOfficialPrice": element.marketOfficialPrice
          })
        }
      }

      console.log(firstMainProduct);
      var discount = data.priceBeforeCoupon - data.totalPrice
      ejs.renderFile(path.resolve(__dirname + "../../../server/views/bills.ejs"), {
        code: data.code,
        ownerName: JSON.parse(JSON.stringify(data.client())).ownerName + "-" + JSON.parse(JSON.stringify(data.client())).shopName,
        phoneNumber: JSON.parse(JSON.stringify(data.client())).phoneNumber,
        firstMainProduct: firstMainProduct,
        secondeMainProduct: secondeMainProduct,
        discount: discount,
        priceBeforeCoupon: data.priceBeforeCoupon,
        totalPrice: data.totalPrice,
        userType: userType,
        date: data.orderDate.getDate() + "/" + (data.orderDate.getMonth() + 1) + "/" + data.orderDate.getFullYear(),
      }, function (err, newhtml) {
        // console.log(newhtml);
        pdf.create(newhtml, options).toFile('./files/pdf/' + name, function (err, res) {
          if (err) return callback(err);
          // console.log(res);
          // console.log(html);
          console.log("discount" + discount)
          console.log("priceBeforeCoupon" + data.priceBeforeCoupon)
          console.log("totalPrice" + data.totalPrice)
          console.log(myConfig.host + '/pdf/' + name);
          callback(null, {
            "path": myConfig.host + '/pdf/' + name
          })
        });
      })
    })

  }
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

    Orders.app.models.user.findById(ctx.req.body.clientId, (err, user) => {
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


  Orders.editOrder = function (id, data, context, callback) {
    console.log(id);
    console.log('upsert called');
    if (!context.req.accessToken || !context.req.accessToken.userId)
      return callback(ERROR(403, 'User not login'))

    if (!data.orderProducts || !Array.isArray(data.orderProducts) || data.orderProducts.length == 0)
      return callback(ERROR(400, 'products can\'t be empty', "PRODUCTS_REQUIRED"))
    var products = data.orderProducts;

    var productsIds = []
    _.each(products, product => {
      try {
        productsIds.push(Orders.dataSource.ObjectID(product.productId).toString());
      } catch (e) {
        return callback(ERROR(400, 'productId not ID'))
      }
    });

    Orders.app.models.user.findById(data.clientId, (err, user) => {
      if (err)
        return callback(err);
      if (!user)
        return callback(ERROR(400, 'user not found'));

      data.clientId = user.id;


      Orders.app.models.orderProducts.find({
        "where": {
          "orderId": id
        }
      }, function (err, oldOrderProducts) {
        if (err)
          return callback(err);
        var oldProductsIds = [];
        oldOrderProducts.forEach(element => {
          oldProductsIds.push(element.productId.toString());
        });

        var deletedProductsId = []
        var newProductsId = []

        oldProductsIds.forEach(element => {
          if (productsIds.includes(element) == false)
            deletedProductsId.push(element)
        });
        productsIds.forEach(element => {
          if (oldProductsIds.includes(element) == false)
            newProductsId.push(element)
        });
        var tempOldProducts = []
        oldOrderProducts.forEach(element => {
          if (deletedProductsId.includes(element.productId.toString()) == false)
            tempOldProducts.push(element)
        });

        console.log("productsIds")
        console.log(productsIds)

        console.log("oldProductsIds");
        console.log(oldProductsIds);

        console.log("deletedProductsId");
        console.log(deletedProductsId);

        console.log("newProductsId");
        console.log(newProductsId);

        console.log("tempOldProducts.length")
        console.log(tempOldProducts.length)



        Orders.app.models.products.find({
          where: {
            id: {
              'inq': newProductsId
            }
          }
        }, function (err, newProducts) {
          if (err)
            return next(err);

          data.clientType = user.clientType;

          var productsInfo = {};
          _.each(newProducts, p => {
            productsInfo[p.id.toString()] = p;
          });

          _.each(tempOldProducts, p => {
            productsInfo[p.productId.toString()] = p;
          });
          data.totalPrice = 0
          console.log("productsInfo.length");
          console.log(productsInfo.length);
          var tempProduct = [];
          _.each(products, (product, index) => {
            var pInfo = productsInfo[product.productId];
            // if (!pInfo)
            //   return delete products[index]
            // if (pInfo.availableTo != user.clientType && pInfo.availableTo != 'both')
            //   return delete products[index]

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
            data.totalPrice += Number(product.count) * Number(product.price);

            product.isOffer = pInfo.isOffer;
            if (pInfo.isOffer && pInfo.products) {
              product.products = JSON.parse(JSON.stringify(pInfo.products()));
            }

            tempProduct.push(product)
          });
          // console.log(tempProduct)
          console.log(data.totalPrice)
          if (data.totalPrice < 20000)
            return callback(ERROR(602, 'total price is low'));

          delete data['orderProducts'];
          delete data['client'];
          console.log(data);

          Orders.findById(id, function (err, mainOrder) {
            if (err)
              return callback(err, null)
            console.log("new couponCode")
            console.log(data.couponCode)
            console.log("old couponCode")
            console.log(mainOrder.couponCode)
            if (data.couponCode == undefined && mainOrder.couponCode == undefined) {
              changeOrderProduct(id, tempProduct, function (err) {
                console.log("no Counpon");
                if (err)
                  return callback(err)
                mainOrder.updateAttributes(data, function (err, data) {
                  if (err)
                    return callback(err)
                  return callback();
                })
              })
            } else if (data.couponCode != undefined && mainOrder.couponCode == undefined) {
              console.log("new counpon");
              Orders.app.models.coupons.findOne({
                where: {
                  code: data.couponCode,
                  expireDate: {
                    gte: new Date()
                  },
                  userId: user.id
                }
              }, function (err, coupon) {
                if (err)
                  return callback(err);
                if (!coupon)
                  return callback(ERROR(400, 'coupon not found or expired date', 'COUPON_NOT_FOUND'));
                if (coupon.numberOfUsed >= coupon.numberOfTimes || coupon.status == 'used')
                  return callback(ERROR(400, 'coupon used for all times', 'COUPON_NOT_AVAILABLE'));

                data.couponId = coupon.id;
                data.priceBeforeCoupon = data.totalPrice;
                if (coupon.type == 'fixed') {
                  data.totalPrice -= coupon.value;
                } else {
                  data.totalPrice -= ((ctx.req.body.totalPrice * coupon.value) / 100)
                }

                // edit coupon
                coupon.numberOfUsed++;
                if (coupon.numberOfUsed == coupon.numberOfTimes)
                  coupon.status = 'used';
                coupon.save(function (err) {
                  if (err)
                    return callback(err);
                  changeOrderProduct(id, tempProduct, function (err) {
                    if (err)
                      return callback(err)
                    mainOrder.updateAttributes(data, function (err, data) {
                      if (err)
                        return callback(err)
                      return callback();
                    })
                  })
                });
              });

            } else {
              return callback(ERROR(604, 'coupon can not change', 'COUPON_CAN_NOT_CHANGE'));
            }
          })
        })
      })
    })
  }

  function changeOrderProduct(id, tempProduct, callback) {
    Orders.app.models.orderProducts.destroyAll({
        "orderId": id
      },
      function (err, isDelete) {
        if (err)
          return callback(err)

        _.each(tempProduct, oneProduct => {
          oneProduct.orderId = id;
        })
        Orders.app.models.orderProducts.create(tempProduct, function (err, data) {
          if (err)
            return callback(err)
          callback()
        })
      })

  }

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
    var tempUserId;
    if (ctx.req.body.clientId != null)
      tempUserId = ctx.req.body.clientId;
    else
      tempUserId = ctx.req.accessToken.userId;

    Orders.app.models.user.findById(tempUserId, (err, user) => {
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
        // console.log("productsFromDb")
        // console.log(productsFromDb)

        var unavalidProd = [];
        productsFromDb.forEach(element => {
          if (element.status != "available") {
            unavalidProd.push(element);
          }
        });

        if (unavalidProd.length != 0) {
          return next({
            "statusCode": 603,
            "data": unavalidProd
          });
        }

        ctx.req.body.status = 'pending';
        ctx.req.body.clientType = user.clientType;
        ctx.req.body.totalPrice = 0;

        var productsInfo = {};
        _.each(productsFromDb, p => {
          productsInfo[p.id.toString()] = p;
        });
        _.each(products, (product, index) => {
          var pInfo = productsInfo[product.productId];
          console.log("**********************");
          console.log(pInfo);

          if (pInfo == null) {
            return delete products[index]
          }
          console.log("-----------------------------")
          console.log(user.clientType)

          if (pInfo.availableTo != user.clientType && pInfo.availableTo != 'both') {
            return delete products[index]
          }
          console.log("///////////////////////////")

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
          console.log("-------------------------")
          console.log(Number(product.count) * Number(product.price))
          ctx.req.body.totalPrice += Number(product.count) * Number(product.price);
          product.isOffer = pInfo.isOffer;
          if (pInfo.isOffer && pInfo.products) {
            product.products = JSON.parse(JSON.stringify(pInfo.products()));
          }
        });
        console.log(ctx.req.body.totalPrice)
        if (ctx.req.body.totalPrice < 20000)
          return next(ERROR(602, 'total price is low'));
        ctx.req.body.priceBeforeCoupon = ctx.req.body.totalPrice;
        console.log("coupon**************************");
        if (!ctx.req.body.couponCode)
          return next();
        console.log("coupon///////////////////////////");

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
            return next(ERROR(607, 'coupon not found or expired date', 'COUPON_NOT_FOUND'));
          if (coupon.numberOfUsed >= coupon.numberOfTimes || coupon.status == 'used')
            return next(ERROR(608, 'coupon used for all times', 'COUPON_NOT_AVAILABLE'));

          ctx.req.body.couponId = coupon.id;
          ctx.req.body.priceBeforeCoupon = ctx.req.body.totalPrice;
          if (coupon.type == 'fixed') {
            ctx.req.body.totalPrice -= coupon.value;
          } else {
            ctx.req.body.totalPrice -= ((ctx.req.body.totalPrice * coupon.value) / 100)
          }

          console.log("coupon///////////////////////////");
          console.log(coupon);
          // edit coupon
          coupon.numberOfUsed += 1;
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

  Orders.assignOrderToCancel = function (orderId, cb) {

    Orders.findById(orderId, function (err, order) {
      if (err)
        return cb(err);
      if (!order)
        return cb(ERROR(404, 'order not found'));
      if (order.status == 'canceled')
        return cb(ERROR(400, 'order already in canceled'));

      order.status = 'canceled';
      order.canceledDate = new Date();
      order.save((err) => {
        return cb(null, 'order is assigned');
      })

    });
  }

  Orders.remoteMethod('assignOrderToCancel', {
    accepts: [{
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
      path: '/:orderId/assignCancel'
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
    Orders.app.models.ordersFromSuppliers.findOne({
      "order": "creationDate DESC"
    }, function (err, oneOrderFromSupplier) {
      if (err)
        return callback(err, null)
      var newDate = new Date();
      var andObject = [{
        status: "pending"
      }];
      if (oneOrderFromSupplier != null)
        andObject.push({
          orderDate: {
            "gt": oneOrderFromSupplier.creationDate
          }
        })
      newDate.setHours(0);
      Orders.find({
        where: {
          and: andObject
        }
      }, function (err, data) {
        // return callback(err, data);
        var products = {};
        var total = 0;
        if (data.length == 0)
          return callback(null, {
            total: total,
            data: []
          });
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
