'use strict';

var _ = require('lodash');
const ejs = require('ejs');
const path = require('path');

var pdf = require('html-pdf');
var myConfig = require('../myConfig');


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
    in: ['pending', 'inWarehouse', 'packed', 'inDelivery', 'delivered', 'canceled']
  });
  Orders.validatesPresenceOf('warehouseId');

  async function validateWarehouseProductsAvailability(warehouse, orderProducts, products) {


    //validate new order products availability in warehouse product 
    let unvalidWarehouseProducts = [];
    let warehouseProductCountUpdates = [];
    for (let product of products) {

      let productAbstractId = product.productAbstract().id;
      let warehouseProduct = await warehouse.warehouseProducts.findOne({ where: { productAbstractId } });
      // warehouse doesn't have  the product 
      if (!warehouseProduct) {
        throw new Error("warehouse doesn't have a product");
      }
      // warehouse doesn't have enough amount of the product 
      let orderProduct = orderProducts.find(p => p.productId == product.id);
      let total = warehouseProduct.expectedCount - orderProduct.count * product.parentCount;

      if (total < warehouseProduct.threshold) {
        unvalidWarehouseProducts.push(product);
      }
      warehouseProductCountUpdates.push({ warehouseProduct, countDiff: (-orderProduct.count * product.parentCount) })
    }

    return { unvalidWarehouseProducts, warehouseProductCountUpdates };

  }


  /**
   * 
   * @param {Product} product source product to clone data from it 
   * @param {WarehouseProduct} warehouseProduct assoicated warehouseProduct to clone data from it 
   */
  function createOrderProductSnapshot(product, warehouseProduct) {


    let snapshot = {};
    // product 
    let productProps = ["nameAr", "nameEn", "horecaPrice", "horecaPriceDiscount", "wholeSalePrice",
      "wholeSalePriceDiscount", "pack", "description",
      "offerSource", "isOffer", "media"];

    productProps.forEach((val, index) => {
      snapshot[val] = product[val];
    });
    // product-abstract                          
    let productAbstractProps = ["officialConsumerPrice", "officialMassMarketPrice"];
    let productAbstract = product.productAbstract();
    productAbstractProps.forEach((val, index) => {
      snapshot[val] = productAbstract[val];
    });

    // warehouse-product 

    snapshot["warehouseAvgBuyingPrice"] = warehouseProduct.avgBuyingPrice;

    return snapshot;
  };

  /**
   * 
   * @param {OrderProduct[]} orderProducts Array of target product to assign the snapshot to 
   * @param {Product[]} products Array of source product to clone the data from
   * @param {Warehouse} warehouse Warhouse to load the data from 
   */
  async function assignOrderProductsSnapshot(orderProducts, products, warehouse) {

    for (let orderProduct of orderProducts) {

      let product = products.find(p => p.id == orderProduct.productId);
      if (!product)
        throw (ERROR(404, "Product not found in db"));

      //order-product snapshot      
      let warehouseProduct = await warehouse.warehouseProducts.findOne({ where: { productAbstractId: product.productAbstractId } });
      orderProduct.orderProductSnapshot = createOrderProductSnapshot(product, warehouseProduct);
    }
  }

  /**
  * 
  * @param {OrderProduct[]} orderProducts Array of order product to calculate sellingPrice for  
  * @param {Product[]} products Array of source product to query the price 
  * @param {User} user Order owner to query clientType 
  */
  function assignOrderProductsSellingPrice(orderProducts, products , user) {

    for (let orderProduct of orderProducts) {

      let product = products.find(p => p.id == orderProduct.productId);
      if (!product)
        throw (ERROR(404, "Product not found in db"));

      if (product.availableTo != user.clientType && product.availableTo != 'both') {
        // @todo check the case 
        continue;
      }
      if (user.clientType == 'wholesale') {
        orderProduct.sellingPrice = product.wholeSalePriceDiscount == 0 ? product.wholeSalePrice : product.wholeSalePriceDiscount;
      } else {
        orderProduct.sellingPrice = product.horecaPriceDiscount == 0 ? product.horecaPrice : product.horecaPriceDiscount;
      }
    }

  }

  /**
   * 
   * @param {OrderProducts[]} orderProducts orderProduct to calculate total price for 
   * @returns number | total price of the order 
   */
  function calcOrderProductsTotalPrice(orderProducts){

    return orderProducts.reduce((accumelator, { count, sellingPrice }) => accumelator  +  Number(count) * Number(sellingPrice), 0); 
    
  }



  Orders.printInvoice = function (id, callback) {
    Orders.findById(id, function (err, data) {
      if (err)
        callback(err)
      var name = new Date().getTime() + ".pdf"
      // 

      // 

      // 

      var userType = ""
      if (data.clientType == "wholesale")
        userType = "الصفة التجارية للمبيع : لمحل مفرق";
      else
        userType = "الصفة التجارية للمبيع : لمحل جملة";


      var firstMainProduct = [];
      var secondeMainProduct = [];
      var orderProducts = JSON.parse(JSON.stringify(data.orderProducts()));
      // console.log("products")
      for (let index = 0; index < orderProducts.length; index++) {
        const element = orderProducts[index];
        if (index < 18)
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
      var paddingFooter = 10;
      if (firstMainProduct.length >= 13 && secondeMainProduct.length == 0)
        paddingFooter = (18 - firstMainProduct.length) * 40
      paddingFooter += "px";

      var discount = Math.round(data.priceBeforeCoupon) - Math.round(data.totalPrice)
      ejs.renderFile(path.resolve(__dirname + "../../../server/views/bills.ejs"), {
        code: data.code,
        ownerName: JSON.parse(JSON.stringify(data.client())).ownerName + " - " + JSON.parse(JSON.stringify(data.client())).shopName,
        phoneNumber: JSON.parse(JSON.stringify(data.client())).phoneNumber,
        firstMainProduct: firstMainProduct,
        secondeMainProduct: secondeMainProduct,
        discount: Math.round(discount),
        priceBeforeCoupon: Math.round(data.priceBeforeCoupon),
        totalPrice: Math.round(data.totalPrice),
        userType: userType,
        paddingFooter: paddingFooter,
        date: data.orderDate.getDate() + "/" + (data.orderDate.getMonth() + 1) + "/" + data.orderDate.getFullYear(),
      }, function (err, newhtml) {

        pdf.create(newhtml, options).toFile('./files/pdf/' + name, function (err, res) {
          if (err) return callback(err);


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

  Orders.editOrder = function (id, data, context, callback) {
    if (!context.req.accessToken || !context.req.accessToken.userId)
      return callback(ERROR(403, 'User not login'))

    if (!data.orderProducts || !Array.isArray(data.orderProducts) || data.orderProducts.length == 0)
      return callback(ERROR(400, 'products can\'t be empty', "PRODUCTS_REQUIRED"))
    var orderProducts = data.orderProducts;
    var isAdmin = false
    if (data.isAdmin == true) {
      isAdmin = true
      delete data.isAdmin;
    }


    var productsIds = []
    _.each(orderProducts, product => {
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
        // old products which are not deleted 
        var tempOldProducts = [];
        // old products which are deleted 
        var oldDeletedOrderProducts = [];

        oldOrderProducts.forEach(element => {
          if (deletedProductsId.includes(element.productId.toString()) == false)
            tempOldProducts.push(element);
          else
            oldDeletedOrderProducts.push(element);

        });



        Orders.app.models.products.find({
          where: {
            id: {
              'inq': productsIds
            }
          }
        }, function (err, productsFromDb) {
          if (err)
            return callback(err);

          var unavalidProd = [];
          productsFromDb.forEach(element => {
            if (element.status != "available") {
              unavalidProd.push(element);
            }
          });

          if (unavalidProd.length != 0) {
            return callback({
              "statusCode": 611,
              "data": unavalidProd
            });
          }


          Orders.app.models.products.find({
            where: {
              id: {
                'inq': newProductsId
              }
            }
          }, async function (err, newProducts) {
            if (err)
              return callback(err);

            let warehouseProductCountUpdates = [];

            let order = await Orders.app.models.orders.findById(id);
            if (!order)
              return callback(ERROR(404, "order not found"));

            let warehouse = order.warehouse();



            try {
              //validate new order products availability in warehouse product 
              let unvalidWarehouseProducts = [];

              let warehouse = order.warehouse();
              let temp = await validateWarehouseProductsAvailability(warehouse, orderProducts, newProducts);

              unvalidWarehouseProducts = [...unvalidWarehouseProducts, ...temp.unvalidWarehouseProducts];
              warehouseProductCountUpdates = [...warehouseProductCountUpdates, ...temp.warehouseProductCountUpdates];

              // validate to be edited order product  availability in warehouse product                   

              let orderProductsCountDiff = tempOldProducts.map(oldProduct => {
                let newOldProduct = orderProducts.find(p => p.productId == oldProduct.productId);
                return { productId: newOldProduct.productId, count: (newOldProduct.count - oldProduct.count) };
              });
              let oldProductsFromDb = tempOldProducts.map(orderProduct => orderProduct.product());

              temp = await validateWarehouseProductsAvailability(warehouse, orderProductsCountDiff, oldProductsFromDb);
              unvalidWarehouseProducts = [...unvalidWarehouseProducts, ...temp.unvalidWarehouseProducts];
              warehouseProductCountUpdates = [...warehouseProductCountUpdates, ...temp.warehouseProductCountUpdates];

              if (unvalidWarehouseProducts.length != 0) {
                return callback({
                  "statusCode": 612, // unavailble in warehouse 
                  "data": unvalidWarehouseProducts
                });
              }

              // add deleted orders product to be updated in warehouse products  
              for (let orderProduct of oldDeletedOrderProducts) {
                let product = orderProduct.product();
                let productAbstractId = product.productAbstract().id;
                let warehouseProduct = await warehouse.warehouseProducts.findOne({ where: { productAbstractId } });
                // warehouse doesn't have  the product 
                if (!warehouseProduct) {
                  throw new Error("warehouse doesn't have a product");
                }
                // warehouse doesn't have enough amount of the product 
                warehouseProductCountUpdates.push({ warehouseProduct, countDiff: (orderProduct.count * product.parentCount) })
              }



            } catch (err) {
              // data format error e.g product doesn't belong to productAbstract 
              return callback(err);
            }



            data.clientType = user.clientType;

          
            try {
              assignOrderProductsSellingPrice(orderProducts, productsFromDb , user);
              await assignOrderProductsSnapshot(orderProducts, productsFromDb, warehouse);
            } catch (err) {
              return next(err);
            }

            let tempProduct = orderProducts;
            // calc total price 
            let totalPrice = calcOrderProductsTotalPrice(orderProducts); 

            if (isAdmin == false && totalPrice < 20000)
              return callback(ERROR(602, 'total price is low'));

            data.totalPrice = totalPrice;
            delete data['orderProducts'];
            delete data['client'];

            Orders.findById(id, function (err, mainOrder) {
              if (err)
                return callback(err, null)
              data.priceBeforeCoupon = data.totalPrice;

              if (data.couponCode == undefined && mainOrder.couponCode == undefined) {
                changeOrderProduct(order, tempProduct, warehouseProductCountUpdates, function (err) {

                  if (err)
                    return callback(err)
                  mainOrder.updateAttributes(data, function (err, data) {
                    if (err)
                      return callback(err)
                    return callback();
                  })
                })
              } else if (data.couponCode != undefined && mainOrder.couponCode == undefined) {

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

                  if (coupon.type == 'fixed') {
                    data.totalPrice -= coupon.value;
                  } else {
                    data.totalPrice -= ((data.totalPrice * coupon.value) / 100)
                  }

                  // edit coupon1

                  coupon.numberOfUsed++;
                  if (coupon.numberOfUsed == coupon.numberOfTimes)
                    coupon.status = 'used';
                  coupon.save()
                  changeOrderProduct(order, tempProduct, warehouseProductCountUpdates, function (err) {
                    if (err)
                      return callback(err)

                    mainOrder.updateAttributes(data, function (err, data) {
                      if (err)
                        return callback(err)
                      return callback();
                    })
                  })
                });
              } else if (data.couponCode != undefined && mainOrder.couponCode != undefined && mainOrder.couponCode == data.couponCode) {

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

                  data.couponId = coupon.id;

                  if (coupon.type == 'fixed') {
                    data.totalPrice -= coupon.value;
                  } else {
                    data.totalPrice -= ((data.totalPrice * coupon.value) / 100)
                  }

                  changeOrderProduct(order, tempProduct, warehouseProductCountUpdates, function (err) {
                    if (err)
                      return callback(err)

                    mainOrder.updateAttributes(data, function (err, data) {
                      if (err)
                        return callback(err)
                      return callback();
                    })
                  })
                });
              } else {
                return callback(ERROR(604, 'coupon can not change', 'COUPON_CAN_NOT_CHANGE'));
              }
            })
          })
        })
      })
    })
  }

  function changeOrderProduct(order, tempProduct, warehouseProductCountUpdates, callback) {
    let id = order.id;


    Orders.app.models.orderProducts.destroyAll({
      "orderId": id
    },
      function (err, isDelete) {
        if (err)
          return callback(err)


        _.each(tempProduct, oneProduct => {
          oneProduct.orderId = id;
        })
        Orders.app.models.orderProducts.create(tempProduct, async function (err, data) {
          if (err)
            return callback(err)

          for (let { warehouseProduct, countDiff } of warehouseProductCountUpdates) {


            try {
              // update warehouse products count 
              await warehouseProduct.updateExpectedCount(countDiff);
              if (['inDelivery', 'delivered'].includes(order.status))
                await warehouseProduct.updateEffictiveCount(countDiff);
            } catch (err) {
              return callback(err);
            }

          }

          callback()
        })
      })

  }



  Orders.beforeRemote('create', function (ctx, modelInstance, next) {
    if (!ctx.req.accessToken || !ctx.req.accessToken.userId)
      return next(ERROR(403, 'User not login'))

    if (!ctx.req.body.orderProducts || !Array.isArray(ctx.req.body.orderProducts) || ctx.req.body.orderProducts.length == 0)
      return next(ERROR(400, 'products can\'t be empty', "PRODUCTS_REQUIRED"))



    //assign first warehouse in database as warehouse for the order
    Orders.app.models.warehouse.findOne({}, (err, warehouse) => {
      ctx.req.body.warehouseId = warehouse.id;


      var orderProducts = ctx.req.body.orderProducts;

      var isAdmin = false
      if (ctx.req.body.isAdmin == true) {
        isAdmin = true
        delete ctx.req.body.isAdmin;
      }

      var productsIds = []
      _.each(orderProducts, product => {
        try {
          productsIds.push(Orders.dataSource.ObjectID(product.productId));
        } catch (e) {
          return next(ERROR(400, 'productId not ID'))
        }
      });

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
              'inq': productsIds
            }
          }
        }, async function (err, productsFromDb) {
          if (err)
            return next(err);


          var unavalidProd = [];
          productsFromDb.forEach(element => {
            if (element.status != "available") {
              unavalidProd.push(element);
            }
          });

          if (unavalidProd.length != 0) {
            return next({
              "statusCode": 611,
              "data": unavalidProd
            });
          }

          try {
            //validate order product availability in warehouse product 
            let { unvalidWarehouseProducts, warehouseProductCountUpdates } = await validateWarehouseProductsAvailability(warehouse, orderProducts, productsFromDb);
            if (unvalidWarehouseProducts.length != 0) {
              return next({
                "statusCode": 612, // unavailble in warehouse 
                "data": unvalidWarehouseProducts
              });
            }
            ctx.warehouseProductCountUpdates = warehouseProductCountUpdates;
          } catch (err) {
            // data format error e.g product doesn't belong to productAbstract 
            return next(err);
          }

          ctx.req.body.status = 'inWarehouse';
          ctx.req.body.clientType = user.clientType;
         
          
          try {
            assignOrderProductsSellingPrice(orderProducts, productsFromDb , user);
            await assignOrderProductsSnapshot(orderProducts, productsFromDb, warehouse);
          } catch (err) {
            return next(err);
          }
          
          // calc total price 
          let totalPrice = calcOrderProductsTotalPrice(orderProducts); 


          if (isAdmin == false && totalPrice < 20000)
            return next(ERROR(602, 'total price is low'));

          ctx.req.body.priceBeforeCoupon = totalPrice;
          ctx.req.body.totalPrice = totalPrice;

          //parse orderProducts 
          ctx.orderProducts = orderProducts;
          delete ctx.req.body.orderProducts;


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
  });



  Orders.afterRemote('create', function (ctx, result, next) {


    let orderProducts = ctx.orderProducts;
    // assign order id to order products 
    for (let orderProduct of orderProducts) {
      orderProduct.orderId = result.id;
    }

    Orders.app.models.orderProducts.create(orderProducts, async function (err, data) {
      if (err)
        return next(err)

      // update warehouse products expected count 
      let warehouseProductCountUpdates = ctx.warehouseProductCountUpdates;

      // @todo bulk update in case of performance issues 
      for (let { warehouseProduct, countDiff } of warehouseProductCountUpdates) {
        try {
          await warehouseProduct.updateExpectedCount(countDiff);
        } catch (err) {
          return next(err);
        }
      }

      Orders.app.models.notification.create({
        "type": "order",
        "orderId": result.id
      }, function (err, data) {
        if (err)
          return next(err)
        result.code = result.id.toString().slice(18);
        return result.save(next);
      });

    });
  });

  Orders.assignOrderToWarehouse = function (orderId, userId, cb) {

    Orders.app.models.user.findById(userId, function (err, user) {
      if (err)
        return cb(err);
      if (!user) {
        return cb(ERROR(404, 'user not found'));
      }
      if (!user.hasPrivilege('userDelivery')) // @todo define role for warehouse  
        return cb(ERROR(400, 'user not delivery'));


      Orders.findById(orderId, function (err, order) {
        if (err)
          return cb(err);
        if (!order)
          return cb(ERROR(404, 'order not found'));


        if (order.status !== 'pending')
          return cb(ERROR(400, 'order is not pending'));


        order.status = 'inWarehouse';
        order.warehouseDate = new Date();
        order.save((err) => {
          if (err) return cb(err);
          // TODO : send Notification to warehouse user  
          return cb(null, 'order is in warehouse');
        })
      });
    });
  };

  Orders.remoteMethod('assignOrderToWarehouse', {
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
      path: '/:orderId/assignWarehouse'
    },
  });


  Orders.assignOrderToPack = function (orderId, userId, cb) {

    Orders.app.models.user.findById(userId, function (err, user) {
      if (err)
        return cb(err);
      if (!user) {
        return cb(ERROR(404, 'user not found'));
      }
      if (!user.hasPrivilege('packageOrder'))
        return cb(ERROR(400, 'user not packageOrder'));


      Orders.findById(orderId, function (err, order) {
        if (err)
          return cb(err);
        if (!order)
          return cb(ERROR(404, 'order not found'));


        if (order.status !== 'inWarehouse')
          return cb(ERROR(400, 'order is not in warehouse'));


        order.status = 'packed';
        order.packDate = new Date();
        order.packagerMemberId = userId;
        order.save((err) => {
          // TODO : send Notification to delivery user   
          return cb(null, 'order is packed');
        })
      });
    });
  };

  Orders.remoteMethod('assignOrderToPack', {
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
      path: '/:orderId/assignPack'
    },
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



      Orders.findById(orderId, async function (err, order) {
        if (err)
          return cb(err);
        if (!order)
          return cb(ERROR(404, 'order not found'));


        if (order.status !== 'packed')
          return cb(ERROR(400, 'order is not ready to deilivery or order is already in delivery'));

        order.status = 'inDelivery';
        order.deliveryMemberId = userId;
        order.assignedDate = new Date();

        for (let orderProduct of order.orderProducts()) {

          let product = orderProduct.product();


          let productAbstractId = product.productAbstract().id;
          let warehouse = order.warehouse();
          let warehouseProduct = await warehouse.warehouseProducts({ productAbstractId });



          warehouseProduct = warehouseProduct[0];
          // update warehouse effictive count 
          await warehouseProduct.updateEffictiveCount(- orderProduct.count * product.parentCount);

        }

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

    Orders.findById(orderId, async function (err, order) {
      if (err)
        return cb(err);
      if (!order)
        return cb(ERROR(404, 'order not found'));
      if (order.status == 'canceled' || order.status === 'delivered')
        return cb(ERROR(400, 'order already in canceled'));


      // @todo in case of performance issues use bulk updates 
      for (let orderProduct of order.orderProducts()) {

        let product = orderProduct.product();
        let productAbstractId = product.productAbstract().id;
        let warehouse = order.warehouse();
        let warehouseProduct = await warehouse.warehouseProducts({ productAbstractId });
        warehouseProduct = warehouseProduct[0];

        // in: ['pending', 'inWarehouse', 'packed', 'inDelivery', 'delivered', 'canceled']        
        // restore warehouse expected count           
        if (['pending', 'inWarehouse', 'packed', 'inDelivery', 'delivered'].includes(order.status)) {
          await warehouseProduct.updateExpectedCount(orderProduct.count * product.parentCount);
        }

        // restore warehouse effictive count 
        if (['inDelivery'].includes(order.status)) {
          await warehouseProduct.updateEffictiveCount(orderProduct.count * product.parentCount);
        }
      }



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

    for (var key in data) {

      result.push(data[key]);
    }
    cb(result);
  }
};
