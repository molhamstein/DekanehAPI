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
    in: ['pending', 'inWarehouse', 'packed', 'pendingDelivery', 'inDelivery', 'delivered', 'canceled']
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
        orderProduct.count = (warehouseProduct.expectedCount - warehouseProduct.threshold) / product.parentCount;
        orderProduct.count = Math.floor(orderProduct.count);
        orderProduct.count = Math.max(orderProduct.count, 0);
        unvalidWarehouseProducts.push(orderProduct);
      }
      warehouseProductCountUpdates.push({ warehouseProduct, countDiff: (-orderProduct.count * product.parentCount), sellingPrice: orderProduct.sellingPrice })
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
    let productProps = ["nameAr", "nameEn", "consumerPriceDiscount", "consumerPrice", "horecaPrice", "horecaPriceDiscount", "wholeSalePrice",
      "wholeSalePriceDiscount", "pack", "description", "isFeatured", "status", "availableTo",
      "isFavorite", "offerMaxQuantity", "code", "sku", "creationDate",
      "offerSource", "isOffer", "media", "productAbstractId", "parentCount"];

    productProps.forEach((val, index) => {
      snapshot[val] = product[val];
    });
    // product-abstract                          
    snapshot["productAbstractSnapshot"] = {};
    let productAbstractProps = ["officialConsumerPrice", "officialMassMarketPrice", "nameEn", "nameAr", "id"];
    let productAbstract = product.productAbstract();
    productAbstractProps.forEach((val, index) => {
      snapshot["productAbstractSnapshot"][val] = productAbstract[val];
    });

    // warehouse-product 

    let warehouseProductProps = ["avgBuyingPrice", "avgSellingPrice"];
    snapshot["warehouseProductSnapshot"] = {};
    warehouseProductProps.forEach((val, index) => {
      snapshot["warehouseProductSnapshot"][val] = warehouseProduct[val];
    });

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
      orderProduct.productSnapshot = createOrderProductSnapshot(product, warehouseProduct);
    }
  }

  /**
  * 
  * @param {OrderProduct[]} orderProducts Array of order product to calculate sellingPrice for  
  * @param {Product[]} products Array of source product to query the price 
  * @param {User} user Order owner to query clientType 
  */
  function assignOrderProductsSellingPrice(orderProducts, products, user) {

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
      } else if (user.clientType == 'horeca') {
        orderProduct.sellingPrice = product.horecaPriceDiscount == 0 ? product.horecaPrice : product.horecaPriceDiscount;
      } else if (user.clientType == 'consumer') {
        orderProduct.sellingPrice = product.consumerPriceDiscount == 0 ? product.consumerPriceDiscount : product.consumerPrice;
      }
    }

  }

  /**
   * 
   * @param {OrderProducts[]} orderProducts orderProduct to calculate total price for 
   * @returns number | total price of the order 
   */
  function calcOrderProductsTotalPrice(orderProducts) {

    return orderProducts.reduce((accumelator, { count, sellingPrice }) => accumelator + Number(count) * Number(sellingPrice), 0);

  }



  Orders.printInvoice = function (id, callback) {

    //@todo check if user has permission to edit the order 

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
                  "statusCode": 612, // unavailable in warehouse 
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
                warehouseProductCountUpdates.push({ warehouseProduct, countDiff: (orderProduct.count * product.parentCount), sellingPrice: orderProduct.sellingPrice })
              }



            } catch (err) {
              // data format error e.g product doesn't belong to productAbstract 
              return callback(err);
            }



            data.clientType = user.clientType;


            try {
              assignOrderProductsSellingPrice(orderProducts, productsFromDb, user);
              await assignOrderProductsSnapshot(orderProducts, productsFromDb, warehouse);
              // restore the price of old products 
              orderProducts = orderProducts.map(orderProduct => {

                let oldOrderPoroduct = oldOrderProducts.find(oldOrderProduct => oldOrderProduct.productId == orderProduct.productId);
                if (!oldOrderPoroduct) return orderProduct;
                orderProduct.productSnapshot = oldOrderPoroduct.productSnapshot;
                orderProduct.sellingPrice = oldOrderPoroduct.sellingPrice;
                return orderProduct;
              });

            } catch (err) {
              return next(err);
            }

            let tempProduct = orderProducts;
            // calc total price 
            let totalPrice = calcOrderProductsTotalPrice(orderProducts);
            if (isAdmin == false) {

              if (user.clientType == 'consumer') {
                if (totalPrice < 10000)
                  return callback(ERROR(602, 'total price is low'));
              } else {
                if (totalPrice < 20000)
                  return callback(ERROR(602, 'total price is low'));

              }
            }
         
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

          for (let { warehouseProduct, countDiff, sellingPrice } of warehouseProductCountUpdates) {


            try {
              // update warehouse products count 
              await warehouseProduct.updateExpectedCount(countDiff);
              if (['inDelivery', 'delivered'].includes(order.status))
                await warehouseProduct.updatetotalCount(countDiff, { sellingPrice });
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

          ctx.req.body.status = 'pending';
          ctx.req.body.clientType = user.clientType;


          try {
            assignOrderProductsSellingPrice(orderProducts, productsFromDb, user);
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


  Orders.assignOrderDeliverer = async function (orderId, userId) {

    let user = await Orders.app.models.user.findById(userId);

    if (!user) {
      throw ERROR(404, 'user not found');
    }
    if (!user.hasPrivilege('deliverPackage'))
      throw ERROR(400, 'user not deliverer');

    let order = await Orders.findById(orderId);

    if (!order)
      throw ERROR(404, 'order not found');

    // prevent adming from changing the deliverer id 
    if (['inDelivery', 'delivered', 'canceled'].includes(order.status))
      throw ERROR(400, 'order is not ready to deilivery or order is already in delivery');
    if (order.deliveryMemberId) {
      // if the order already has a deliverer 
    }
    order.deliveryMemberId = userId;
    await order.save();
    return 'order deliveryMember is assigned';


  }

  // assign order states 

  Orders.assignOrderToWarehouse = async function (orderId, userId) {

    let user = await Orders.app.models.user.findById(userId);

    if (!user) {
      throw ERROR(404, 'user not found');
    }

    if (!user.hasPrivilege('warehouse_keeper'))
      throw ERROR(400, 'user is not warehouse keeper');

    let order = await Orders.findById(orderId);

    if (!order)
      throw ERROR(404, 'order not found');


    if (!order.warehouseId) {
      order.warehouseId = (await Orders.app.models.warehouse.findOne({})).id;
    }
    if (order.status !== 'pending')
      throw ERROR(400, 'order is not pending');


    order.warehouseKeeperId = userId;
    order.status = 'inWarehouse';
    order.warehouseDate = new Date();
    await order.save();

    return 'order is in warehouse';
  };


  Orders.assignOrderToPack = async function (orderId) {

    let order = await Orders.findById(orderId);

    if (!order)
      throw ERROR(404, 'order not found');

    if (order.status !== 'inWarehouse')
      throw ERROR(400, 'order is not in warehouse');


    order.status = 'packed';
    order.packDate = new Date();


    if (order.deliveryMemberId) {
      // if the order already has a deliverer move order state directly to pendingDeliverer
      order.status = 'pendingDelivery';
    }

    await order.save();

    return 'order is packed';
  };


  Orders.assignOrderPendingDelivery = async function (orderId, userId) {

    let user = await Orders.app.models.user.findById(userId);

    if (!user) {
      throw ERROR(404, 'user not found');
    }
    if (!user.hasPrivilege('deliverPackage'))
      throw ERROR(400, 'user not deliverer');

    let order = await Orders.findById(orderId);

    if (!order)
      throw ERROR(404, 'order not found');

    if (order.status !== 'packed')
      throw ERROR(400, 'order is not ready to deilivery or order is already in delivery');

    order.status = 'pendingDelivery';
    order.deliveryMemberId = userId;
    await order.save();

    return 'order is assigned';
  }


  Orders.assignOrderToDelivery = async function (orderId) {

    //@todo check if the user has the order as deliveryId  
    let order = await Orders.findById(orderId);


    if (!order)
      throw ERROR(404, 'order not found');

    if (order.status !== 'pendingDelivery')
      throw ERROR(400, 'order is not ready to deilivery or order is already in delivery');

    order.status = 'inDelivery';
    order.deliveryReceptionDate = new Date();

    for (let orderProduct of order.orderProducts()) {

      let product = orderProduct.product();
      let productAbstractId = product.productAbstract().id;
      let warehouse = order.warehouse();
      let warehouseProduct = await warehouse.warehouseProducts({ where: { productAbstractId } });
      warehouseProduct = warehouseProduct[0];
      // update warehouse total count 
      await warehouseProduct.updatetotalCount(- orderProduct.count * product.parentCount, { sellingPrice: orderProduct.sellingPrice });

    }
    await order.save();
    // TODO : send Notification to user delivery 
    notifications.orderInDelievery(order);
    return 'order is assigned';


  }

  Orders.assignOrderDeliverd = async function (req, orderId) {

    if (!req.user)
      throw ERROR(403, 'user not login');


    let order = await Orders.findById(orderId);

    if (!order)
      throw ERROR(404, 'order not found');


    if (order.status != 'inDelivery')
      throw ERROR(400, 'order not in delivery');

    // TODO : or admin can edit order status to delivered
    // if(order.deliveryMemberId != req.user.id.toString())
    // 	return cb(ERROR (500,'not privilege to this order'));

    // update user balance 
    let user = await order.client.getAsync();
    user.balance -= order.totalPrice;
    await user.save();

    order.status = 'delivered';
    order.deliveredDate = new Date();
    await order.save();
    // TODO : send Notification to client for rate this order 
    notifications.afterOrderDelivered(order);
    return 'order is delivered';

  }


  Orders.assignOrderToCancel = async function (orderId) {

    let order = await Orders.findById(orderId);

    if (!order)
      throw ERROR(404, 'order not found');

    if (order.status == 'canceled')
      throw ERROR(400, 'the order has been canceled already');

    for (let orderProduct of order.orderProducts()) {

      let product = orderProduct.product();
      let productAbstractId = product.productAbstract().id;
      let warehouse = order.warehouse();
      let warehouseProduct = await warehouse.warehouseProducts({ where: { productAbstractId } });
      warehouseProduct = warehouseProduct[0];

      // in: ['pending', 'inWarehouse', 'packed', 'pendingDelivery', 'inDelivery', 'delivered', 'canceled'] 

      if (['pending', 'inWarehouse', 'packed', 'inDelivery', 'pendingDelivery', 'delivered'].includes(order.status)) {
        await warehouseProduct.updateExpectedCount(orderProduct.count * product.parentCount);
      }

      // restore warehouse total count 
      if (['inDelivery', 'delivered'].includes(order.status)) {
        await warehouseProduct.updatetotalCount(orderProduct.count * product.parentCount, { sellingPrice: orderProduct.sellingPrice });
      }
    }

    order.status = 'canceled';
    order.canceledDate = new Date();
    await order.save();

    return 'order is assigned';
  }




  Orders.list = async function (req) {

    let collection = Orders.app.models.orders;

    // orders which are in the last 24 hours 
    let begin = new Date();
    let end = new Date();
    begin.setHours(begin.getHours() - 24);
    let betweenObj = { between: [begin, end] };
    let pending = collection.find({ where: { orderDate: betweenObj, status: 'pending' } });
    let warehouse = collection.find({ where: { orderDate: betweenObj, status: { inq: ['inWarehouse', 'packed'] } } });
    let delivery = collection.find({ where: { orderDate: betweenObj, status: 'inDelivery' } });
    let done = collection.find({ where: { orderDate: betweenObj, status: { inq: ['delivered', 'canceled'] } } });

    [pending, warehouse, delivery, done] = await Promise.all([pending, warehouse, delivery, done]);
    return { pending, warehouse, delivery, done };


  }


  Orders.daily = function (res, from, to, productAbstractId, cb) {


    let and = [];
    if (from)
      and.push({ orderDate: { $gte: from } });

    if (to)
      and.push({ orderDate: { $lte: to } });


    if (and.length)
      and = [{ $match: { $and: and } }];

    let matchProductAbstractId = [

      {
        $match: {
          "orderProduct.productSnapshot.productAbstractId": {
            $ne: null
          }
        }
      }
    ];

    if (productAbstractId) {
      matchProductAbstractId.push({ $match: { "orderProduct.productSnapshot.productAbstractId": ObjectId(productAbstractId) } });
    }

    let stages =
      [
        ...and,
        {
          $lookup: {
            from: 'orderProducts',
            localField: '_id',
            foreignField: 'orderId',
            as: 'orderProduct'
          }
        },
        {
          $unwind: "$orderProduct"
        },
        ...matchProductAbstractId
        ,
        {
          $group: {
            _id: { month: { $month: "$orderDate" }, day: { $dayOfMonth: "$orderDate" }, year: { $year: "$orderDate" } },
            count: { $sum: { $multiply: ["$orderProduct.count", "$orderProduct.productSnapshot.parentCount"] } },
            cost: { $sum: { $multiply: ["$orderProduct.count", "$orderProduct.buyingPrice"] } },
          }
        }
      ];

    let productsStages = [
      ...and,
      {
        $lookup: {
          from: 'orderProducts',
          localField: '_id',
          foreignField: 'orderId',
          as: 'orderProduct'
        }
      },
      {
        $unwind: "$orderProduct"
      },
      ...matchProductAbstractId
      ,
      {
        $group: {
          _id: { productAbstractId: "$orderProduct.productSnapshot.productAbstractId" },
          count: { $sum: { $multiply: ["$orderProduct.count", "$orderProduct.productSnapshot.parentCount"] } },
          cost: { $sum: { $multiply: ["$orderProduct.count", "$orderProduct.buyingPrice"] } },
          productSnapshot: { $first: "$orderProduct.productSnapshot" }
        }
      },

    ];


    Orders.getDataSource().connector.connect((err, db) => {
      let collection = db.collection("orders");
      collection.aggregate(stages, (err, result) => {

        collection.aggregate(productsStages, (err, productsResult) => {
          res.json({ result, products: productsResult });
        });

      });
    });

  }

  Orders.warehoueKeeperOrders = async function (req, from, to, status) {
    let { user } = req;

    if (!user)
      throw ERROR(403, 'User not login');

    let and = [];

    and.push({ warehouseKeeperId: user.id });

    if (status)
      and.push({ status });
    else
      and.push({ status: { inq: ['inWarehouse', 'packed', 'pendingDelivery'] } });


    if (from)
      and.push({ orderDate: { gte: from } });
    if (to)
      and.push({ orderDate: { lte: to } });


    return Orders.app.models.orders.find({ where: { and } });

  }

};
