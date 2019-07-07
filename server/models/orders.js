'use strict';

var _ = require('lodash');
const ejs = require('ejs');
const path = require('path');
var mongoXlsx = require('mongo-xlsx');

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
      let orderProduct = orderProducts.find(p => p.productId.toString() == product.id.toString());
      let total = warehouseProduct.expectedCount - orderProduct.count * product.parentCount;

      if (total < warehouseProduct.threshold) {
        orderProduct.count = (warehouseProduct.expectedCount - warehouseProduct.threshold) / product.parentCount;
        orderProduct.count = Math.floor(orderProduct.count);
        orderProduct.count = Math.max(orderProduct.count, 0);
        unvalidWarehouseProducts.push(orderProduct);
      }
      warehouseProductCountUpdates.push({ warehouseProduct, countDiff: (-orderProduct.count * product.parentCount), sellingPrice: (orderProduct.sellingPrice ? orderProduct.sellingPrice : 0) })
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
        userTyppe = "الصفة التجارية للمبيع : لمحل مفرق";
      else
        userType = "الصفة التجارية للمبيع : لمحل جملة";


      var firstMainProduct = [];
      var secondeMainProduct = [];
      var orderProducts = JSON.parse(JSON.stringify(data.orderProducts()));
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



  async function changeOrderProduct(order, tempProduct, warehouseProductCountUpdates) {
    let id = order.id;


    let isDelete = await Orders.app.models.orderProducts.destroyAll({
      "orderId": id
    });


    _.each(tempProduct, oneProduct => {
      oneProduct.orderId = id;
    });

    let data = await Orders.app.models.orderProducts.create(tempProduct);

    for (let { warehouseProduct, countDiff, sellingPrice } of warehouseProductCountUpdates) {
      // update warehouse products count 
      await warehouseProduct.updateExpectedCount(countDiff);
      if (['inDelivery', 'delivered'].includes(order.status))
        await warehouseProduct.updatetotalCount(countDiff, { sellingPrice });

    }


  }

  function checkUserLogin(context) {

    if (!context.req.accessToken || !context.req.accessToken.userId)
      throw ERROR(403, 'User not login');
  }

  function checkProductsExistence(orderProducts) {
    if (!orderProducts || !Array.isArray(orderProducts) || orderProducts.length == 0)
      throw ERROR(400, 'products can\'t be empty', "PRODUCTS_REQUIRED");
  }

  function checkUnAvailableProducts(productsFromDb) {
    let unavailableProducts = productsFromDb.filter(product => product.status != "available");

    if (unavailableProducts.length != 0) {
      throw { "statusCode": 611, "data": unavailableProducts };
    }

  }

  function checkTotalPrice(totalPrice, isAdmin, user) {

    if (isAdmin == false) {
      if (user.clientType == 'consumer') {
        if (totalPrice < 5000)
          throw (ERROR(602, 'total price is low'));
      } else {
        if (totalPrice < 20000)
          throw (ERROR(602, 'total price is low'));
      }
    }
  }

  function checkCoupon(coupon) {

    if (!coupon)
      throw (ERROR(607, 'coupon not found or expired date', 'COUPON_NOT_FOUND'));
    if (coupon.numberOfUsed >= coupon.numberOfTimes || coupon.status == 'used')
      throw (ERROR(608, 'coupon used for all times', 'COUPON_NOT_AVAILABLE'));

    if (coupon.onhold == true)
      throw ERROR(609, 'coupon is on hold');



  }
  function calculateCouponDiscount(price, coupon) {

    if (coupon.type == 'fixed') {
      return price - coupon.value;
    } else {
      return price - ((price * coupon.value) / 100)
    }
  }
  function checkDuplicateProducts(products) {
    let duplicate = products.find(({ productId: idI }, indexI) => products.find(({ productId: idJ }, indexJ) => indexI != indexJ && idI.toString() == idJ.toString()));

    if (duplicate)
      throw ERROR(620, 'duplicate  products');

  }
  Orders.beforeRemote('create', async function (ctx, modelInstance) {


    checkUserLogin(ctx);

    checkProductsExistence(ctx.req.body.orderProducts);

    checkDuplicateProducts(ctx.req.body.orderProducts);

    let warehouse = await Orders.app.models.warehouse.findOne({});
    //assign first warehouse in database as warehouse for the order
    ctx.req.body.warehouseId = warehouse.id;


    var orderProducts = ctx.req.body.orderProducts;

    var isAdmin = false;

    if (ctx.req.body.isAdmin == true) {
      isAdmin = true
      delete ctx.req.body.isAdmin;
    }

    let productsIds = orderProducts.map(product => Orders.dataSource.ObjectID(product.productId));


    var tempUserId;
    if (ctx.req.body.clientId != null)
      tempUserId = ctx.req.body.clientId;
    else
      tempUserId = ctx.req.accessToken.userId;



    let user = await Orders.app.models.user.findById(tempUserId);

    if (!user)
      throw ERROR(400, 'user not found');


    ctx.req.body.clientId = user.id;

    let productsFromDb = await Orders.app.models.products.find({
      where: {
        id: {
          'inq': productsIds
        }
      }
    });


    checkUnAvailableProducts(productsFromDb);


    //validate order product availability in warehouse product 
    let { unvalidWarehouseProducts, warehouseProductCountUpdates } = await validateWarehouseProductsAvailability(warehouse, orderProducts, productsFromDb);
    if (unvalidWarehouseProducts.length != 0) {
      throw {
        "statusCode": 612, // unavailble in warehouse 
        "data": unvalidWarehouseProducts
      };
    }

    // pass data to after create 
    ctx.warehouseProductCountUpdates = warehouseProductCountUpdates;

    ctx.req.body.status = 'pending';
    ctx.req.body.clientType = user.clientType;


    assignOrderProductsSellingPrice(orderProducts, productsFromDb, user);
    await assignOrderProductsSnapshot(orderProducts, productsFromDb, warehouse);


    // calc total price 
    let totalPrice = calcOrderProductsTotalPrice(orderProducts);

    checkTotalPrice(totalPrice, isAdmin, user);


    ctx.req.body.priceBeforeCoupon = totalPrice;
    ctx.req.body.totalPrice = totalPrice;

    //parse orderProducts 
    ctx.orderProducts = orderProducts;
    delete ctx.req.body.orderProducts;


    if (ctx.req.body.couponCode) {

      let coupon = await Orders.app.models.coupons.findOne({
        where: {
          code: ctx.req.body.couponCode,
          expireDate: {
            gte: new Date()
          },
          userId: user.id
        }
      });

      checkCoupon(coupon);

      ctx.req.body.couponId = coupon.id;
      ctx.req.body.priceBeforeCoupon = ctx.req.body.totalPrice;

      ctx.req.body.totalPrice = calculateCouponDiscount(totalPrice, coupon);



      // edit coupon
      coupon.numberOfUsed += 1;
      if (coupon.numberOfUsed == coupon.numberOfTimes)
        coupon.status = 'used';
      await coupon.save();

    }




  });

  // @todo refactor with coupon.js 
  var generateCodeNumber = function () {
    return Math.floor(100000 + Math.random() * 900000)
  }


  async function addOrderPrizes(order, prizes, warehouseProductCountUpdates) {
    let id = order.id;

    prizes.forEach(oneProduct => {
      oneProduct.orderId = id;
    });

    await Orders.app.models.orderPrize.create(prizes);
    for (let { warehouseProduct, countDiff } of warehouseProductCountUpdates) {
      // update warehouse products count 
      await warehouseProduct.updateExpectedCount(countDiff);
    }

  }

  async function rewardUser(order, award, userAward, notify = true) {

    // add coupon 
    // add prizes 
    // check stock 
    // update stock 
    // update order 
    // update award count 
    // notify user 


    let { clientId, warehouseId } = order;
    let awardId = award._id ? award._id : award.id;
    for (let coupon of award.coupons) {

      let userCoupon = {};
      let propsToClone = ["value", "type", "numberOfTimes"];
      for (let prop of propsToClone)
        userCoupon[prop] = coupon[prop];


      userCoupon.code = generateCodeNumber();
      userCoupon.numberOfUsed = 0;
      userCoupon.userId = clientId;
      userCoupon.userAwardId = userAward.id;
      userCoupon.orderId = order.id;
      userCoupon.onhold = true;
      let date = new Date();
      date.setDate(date.getDate() + coupon.duration);
      userCoupon.expireDate = date;

      await Orders.app.models.coupons.create(userCoupon);

    }


    if (award.prizes) {

      let productsIds = award.prizes.map(p => p.productId);

      let productsFromDb = await Orders.app.models.products.find({
        where: {
          id: {
            'inq': productsIds
          }
        }
      });
      let orderPrizes = award.prizes.map(prize => {
        let orderPrize = {};


        orderPrize.count = prize.count;
        orderPrize.userAwardId = userAward.id.toString();
        orderPrize.productId = prize.productId.toString();

        return orderPrize;

      });


      let warehouse = await Orders.app.models.warehouse.findById(warehouseId);

      let { unvalidWarehouseProducts, warehouseProductCountUpdates } =
        await validateWarehouseProductsAvailability(warehouse, orderPrizes, productsFromDb);

      if (unvalidWarehouseProducts.length) {
        await Orders.app.models.notification.create({
          "type": "prizeOutOfStock",
          "orderId": order.id,
          object: { "awardId": awardId }
        });

      }
      await addOrderPrizes(order, orderPrizes, warehouseProductCountUpdates);
    }
    order.awards.add(awardId);
    let complete = false;
    award.count++;
    if (award.countLimit != 0 && award.count == award.countLimit)
      complete = true;

    await Orders.app.models.award.updateAll({ id: awardId.toString() }, { count: award.count, complete });
    await order.save();

    if (notify)
      notifications.rewardUser(order, award);


  }

  async function restoreOrderPrizes(order, orderPrizes) {

    for (let orderPrize of orderPrizes) {

      let product = orderPrize.product();
      let productAbstractId = product.productAbstract().id;
      let warehouse = order.warehouse();
      let warehouseProduct = await warehouse.warehouseProducts({ where: { productAbstractId } });
      warehouseProduct = warehouseProduct[0];

      await warehouseProduct.updateExpectedCount(orderPrize.count * product.parentCount);

      // restore warehouse total count 
      if (['inDelivery', 'delivered'].includes(order.status)) {
        await warehouseProduct.updatetotalCount(orderPrize.count * product.parentCount, { sellingPrice: 0 });
      }
    }
  }
  async function removeOrderUserAward(order, award, userAward, orderChanged = false) {

    // remove coupon 


    // update stock 
    // remove prizes 

    // update order 
    // update award count 

    let awardId = award._id ? award._id : award.id;
    let userAwardId = userAward.id;
    let orderId = order.id;

    // if the order is already deleted do not remove prizes 

    if (order.status != 'delivered' || orderChanged) {
      // delete coupons 
      await Orders.app.models.coupons.deleteAll({ userAwardId, orderId, numberOfUsed: 0 });

      // remove prizes 
      let orderPrizes = order.orderPrizes().filter(orderPrize => orderPrize.userAwardId.toString() == userAwardId.toString() && orderPrize.orderId.toString() == orderId.toString());
      await restoreOrderPrizes(order, orderPrizes);
      await Orders.app.models.orderPrize.deleteAll({ userAwardId, orderId });


      order.awards.remove(awardId);
      award.count--;
      await Orders.app.models.award.updateAll({ id: awardId.toString() }, { count: award.count, complete: false });

      await order.save();


    }



  }

  async function getMatchAwards(order) {

    let { clientType } = order;
    let orderDate = new Date(order.orderDate);
    let client = await Orders.app.models.user.findOne(order.clientId);
    let clientAreaId = client.areaId;
    let clientLevelId = client.levelId;

    return new Promise((res, rej) => {

      Orders.getDataSource().connector.collection('award')
        .aggregate(
          [
            {
              $match: {
                $and: [
                  {
                    status: "activated"
                  },
                  {
                    complete: false
                  },
                  {
                    from: { $lte: orderDate },
                    to: { $gte: orderDate }
                  },
                  {
                    $or: [
                      { clientTypes: clientType },
                      { clientTypes: [] }
                    ]
                  },
                  {
                    $or: [
                      { areaIds: clientAreaId },
                      { areaIds: [] }
                    ]
                  },
                  {
                    $or: [
                      { levelIds: clientLevelId },
                      { levelIds: [] }
                    ]
                  }
                ]
              }
            },
            {
              $lookup: {
                from: 'awardPeriod',
                localField: '_id',
                foreignField: 'awardId',
                as: 'periods'
              }
            }
          ]
          , (err, result) => {
            if (err) return rej(err);
            res(result);
          });
    });


  }
  function calcOrderAwardProgress(award, order) {

    // order that has coupon contribute in 0 progess 
    if (order.couponId)
      return 0;
    let orderProducts = order.orderProducts();
    let { totalPrice } = order;

    let action = award.action;
    let progressDiff = 0;
    // update user award progress according to the action type 
    if (action.type == 'price') {
      progressDiff = totalPrice;

    } else if (action.type == 'count') { // orders count 

      progressDiff = 1;

    } else if (action.type == 'products-price') {
      let productIds = action.productIds;

      let orderAwardProducts = orderProducts.filter(orderProduct =>
        productIds.find(id => id.toString() == orderProduct.product().id.toString()) != undefined
      );

      if (orderAwardProducts.length == 0) return 0;

      progressDiff = orderAwardProducts.reduce((sum, { sellingPrice, count }) => count * sellingPrice + sum, 0);

    } else if (action.type == 'products-count') {

      let productIds = action.productIds;

      let orderAwardProducts = orderProducts.filter(orderProduct =>
        productIds.find(id => id.toString() == orderProduct.product().id.toString()) != undefined
      );

      if (orderAwardProducts.length == 0) return 0;

      progressDiff = orderAwardProducts.reduce((sum, { count }) => count + sum, 0);

    } else if (action.type == 'company-price') {

      let manufacturerId = action.manufacturerId.toString();

      let orderAwardProducts = orderProducts.filter(orderProduct =>
        orderProduct.product().manufacturerId.toString() == manufacturerId
      );

      if (orderAwardProducts.length == 0) return 0;

      progressDiff = orderAwardProducts.reduce((sum, { sellingPrice, count }) => count * sellingPrice + sum, 0);

    } else if (action.type == 'company-count') {

      let manufacturerId = action.manufacturerId.toString();

      let orderAwardProducts = orderProducts.filter(orderProduct =>
        orderProduct.product().manufacturerId.toString() == manufacturerId
      );

      if (orderAwardProducts.length == 0) return 0;

      progressDiff = orderAwardProducts.reduce((sum, { count }) => count + sum, 0);

    }
    return progressDiff;

  }

  async function recalculateOrderUserAward(award, userAward, order, newProgressDiff) {

    // reinitiate userAward 
    let changeOrderId = order.id;
    let oldProgress = 0;
    let curProgress = 0;
    let curComplete = false;
    let curCount = 0;
    let oldCount = 0;
    let oldComplete = false;
    userAward.complete = false;
    userAward.progress = 0;
    let rewards = [];
    let removes = [];
    let action = award.action;
    for (let userAwardOrder of userAward.orders) {
      let curOrderId = userAwardOrder.orderId;
      if (userAwardOrder.orderId.toString() == changeOrderId.toString()) {
        // current order 
        oldProgress += userAwardOrder.progressDiff;
        userAwardOrder.progressDiff = newProgressDiff;
        curProgress += userAwardOrder.progressDiff;

      } else {
        oldProgress += userAwardOrder.progressDiff;

        curProgress += userAwardOrder.progressDiff;
      }

      userAwardOrder.count = curCount;

      let removeAward = false;
      let getAward = false;

      if (curProgress >= action.target) {
        curProgress = 0;
        curCount++;
        getAward = true;
      }

      if (oldProgress >= action.target) {
        oldProgress = 0;
        oldCount++;
        removeAward = true;
      }

      if (curComplete) {
        getAward = false;
      }
      if (oldComplete) {
        removeAward = false;
      }

      if (removeAward && getAward) {
        // do nothing 
      } else if (getAward) {
        rewards.push(curOrderId);
      } else if (removeAward) {
        removes.push(curOrderId);
      }


      if (curCount == award.times) {
        curComplete = true;
        userAward.progress = curProgress;
        userAward.count = curCount;
        userAward.complete = true;
      }
      if (oldCount == award.times) {
        oldComplete = true;
      }

    }

    for (let orderId of removes) {
      let order = await Orders.findById(orderId);
      await removeOrderUserAward(order, award, userAward, orderId.toString() == changeOrderId.toString());
    }
    for (let orderId of rewards) {
      let order = await Orders.findById(orderId);
      await rewardUser(order, award, userAward, false);
    }


    if (!userAward.complete) {
      userAward.progress = curProgress;
      userAward.count = curCount;
    }


    await userAward.save();
  }
  async function processEditOrderAward(orderId) {

    let order = await Orders.findById(orderId);
    let userAwards = await Orders.app.models.userAward.find({
      where: { orders: { elemMatch: { orderId } } }
    });

    for (let userAward of userAwards) {
      let award = await userAward.award.getAsync();

      let newProgressDiff = calcOrderAwardProgress(award, order);
      await recalculateOrderUserAward(award, userAward, order, newProgressDiff);

    }

  }
  async function processCancelOrderAward(orderId) {

    let order = await Orders.findById(orderId);
    let userAwards = await Orders.app.models.userAward.find({
      where: { orders: { elemMatch: { orderId } } }
    });

    for (let userAward of userAwards) {
      let award = await userAward.award.getAsync();

      await recalculateOrderUserAward(award, userAward, order, 0);

    }

  }


  async function processOrderAward(order) {


    let { clientId } = order;
    let orderDate = new Date(order.orderDate);


    let awards = await getMatchAwards(order);

    let orderDb = await Orders.findById(order.id);



    for (let award of awards) {

      let progressDiff = calcOrderAwardProgress(award, orderDb);


      // find the current period 
      let action = award.action;
      let period = award.periods.find(({ from, to }) => orderDate >= from && orderDate <= to);

      let [userAward] = await Orders.app.models.userAward.findOrCreate({ where: { awardPeriodId: period._id, userId: clientId } }, { awardId: award._id, awardPeriodId: period._id, userId: clientId });


      userAward.orders.push({ orderId: order.id, count: userAward.count, date: new Date(), progressDiff });


      if (userAward.complete) {
        await userAward.save();
        continue;
      }


      userAward.progress += progressDiff;

      if (userAward.progress >= action.target) {
        await rewardUser(orderDb, award, userAward);
        userAward.progress = 0;
        userAward.count++;
      }


      if (userAward.count == award.times) {
        userAward.complete = true;
      }
      await userAward.save();

    }




  }

  Orders.afterRemote('create', async function (ctx, result) {


    let orderProducts = ctx.orderProducts;
    // assign order id to order products 
    for (let orderProduct of orderProducts) {
      orderProduct.orderId = result.id;
    }

    await Orders.app.models.orderProducts.create(orderProducts);


    // update warehouse products expected count 
    let warehouseProductCountUpdates = ctx.warehouseProductCountUpdates;

    // @todo bulk update in case of performance issues 
    for (let { warehouseProduct, countDiff } of warehouseProductCountUpdates) {

      await warehouseProduct.updateExpectedCount(countDiff);

    }

    //admin notification 
    await Orders.app.models.notification.create({
      "type": "order",
      "orderId": result.id
    });

    result.code = result.id.toString().slice(18);




    let orderResult = await result.save();


    // if order has no coupon 
    await processOrderAward(orderResult);

    let order = await Orders.findById(result.id);
    ctx.result = order;

  });

  Orders.editOrder = async function (id, data, context) {

    // @note: in case of any failure do not change the database 

    checkUserLogin(context);
    checkProductsExistence(data.orderProducts);
    checkDuplicateProducts(data.orderProducts);

    var orderProducts = data.orderProducts;
    var isAdmin = false
    if (data.isAdmin == true) {
      isAdmin = true
      delete data.isAdmin;
    }

    /**
     * Split products into 
     * new products 
     * deleted products 
     * remaining products 
     */

    let productsIds = orderProducts.map(product => Orders.dataSource.ObjectID(product.productId).toString());


    let user = await Orders.app.models.user.findById(data.clientId);
    if (!user)
      throw ERROR(400, 'user not found');

    data.clientId = user.id;


    let oldProducts = await Orders.app.models.orderProducts.find({
      "where": {
        "orderId": id
      }
    });


    let oldProductsIds = oldProducts.map(element => element.productId.toString());


    let deletedProductsId = oldProductsIds.filter(element => productsIds.includes(element) == false);

    let newProductsId = productsIds.filter(element => oldProductsIds.includes(element) == false);

    // old products which are not deleted 
    var remainingProducts = [];

    // old products which are deleted 
    var deletedProducts = [];

    oldProducts.forEach(element => {
      if (deletedProductsId.includes(element.productId.toString()) == false)
        remainingProducts.push(element);
      else
        deletedProducts.push(element);

    });



    let productsFromDb = await Orders.app.models.products.find({
      where: {
        id: {
          'inq': productsIds
        }
      }
    });



    checkUnAvailableProducts(productsFromDb);



    let newProducts = await Orders.app.models.products.find({
      where: {
        id: {
          'inq': newProductsId
        }
      }
    });

    let warehouseProductCountUpdates = [];

    let order = await Orders.findById(id);
    if (!order)
      throw ERROR(404, "order not found");

    let warehouse = await order.warehouse();


    //validate new order products availability in warehouse product 
    let unvalidWarehouseProducts = [];

    let temp = await validateWarehouseProductsAvailability(warehouse, orderProducts, newProducts);

    unvalidWarehouseProducts = [...unvalidWarehouseProducts, ...temp.unvalidWarehouseProducts];
    warehouseProductCountUpdates = [...warehouseProductCountUpdates, ...temp.warehouseProductCountUpdates];

    // validate to be edited order product  availability in warehouse product                   

    let orderProductsCountDiff = remainingProducts.map(oldProduct => {
      let newOldProduct = orderProducts.find(p => p.productId == oldProduct.productId);
      return { productId: newOldProduct.productId, count: (newOldProduct.count - oldProduct.count) };
    });
    let oldProductsFromDb = remainingProducts.map(orderProduct => orderProduct.product());

    temp = await validateWarehouseProductsAvailability(warehouse, orderProductsCountDiff, oldProductsFromDb);
    unvalidWarehouseProducts = [...unvalidWarehouseProducts, ...temp.unvalidWarehouseProducts];
    warehouseProductCountUpdates = [...warehouseProductCountUpdates, ...temp.warehouseProductCountUpdates];



    if (unvalidWarehouseProducts.length != 0) {
      throw {
        "statusCode": 612, // unavailable in warehouse 
        "data": unvalidWarehouseProducts
      };
    }

    // add deleted orders product to be updated in warehouse products  
    for (let orderProduct of deletedProducts) {
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


    data.clientType = user.clientType;


    assignOrderProductsSellingPrice(orderProducts, productsFromDb, user);
    await assignOrderProductsSnapshot(orderProducts, productsFromDb, warehouse);
    // restore the price of old products 
    orderProducts = orderProducts.map(orderProduct => {

      let oldOrderPoroduct = oldProducts.find(oldOrderProduct => oldOrderProduct.productId == orderProduct.productId);
      if (!oldOrderPoroduct) return orderProduct;
      orderProduct.productSnapshot = oldOrderPoroduct.productSnapshot;
      orderProduct.sellingPrice = oldOrderPoroduct.sellingPrice;
      return orderProduct;
    });


    let tempProduct = orderProducts;
    // calc total price 
    let totalPrice = calcOrderProductsTotalPrice(orderProducts);
    checkTotalPrice(totalPrice, isAdmin, user);

    data.totalPrice = totalPrice;
    delete data['orderProducts'];
    delete data['client'];

    data.priceBeforeCoupon = data.totalPrice;


    if (data.couponCode == undefined && order.couponCode == undefined) {
      // do nothing 
    } else if (data.couponCode != undefined && order.couponCode == undefined) {

      let coupon = await Orders.app.models.coupons.findOne({
        where: {
          code: data.couponCode,
          expireDate: {
            gte: new Date()
          },
          userId: user.id
        }
      });

      checkCoupon(coupon);

      data.couponId = coupon.id;

      data.totalPrice = calculateCouponDiscount(data.totalPrice, coupon);

      // edit coupon1

      coupon.numberOfUsed++;
      if (coupon.numberOfUsed == coupon.numberOfTimes)
        coupon.status = 'used';

      await coupon.save()


    } else if (data.couponCode != undefined && order.couponCode != undefined && order.couponCode == data.couponCode) {

      let coupon = await Orders.app.models.coupons.findOne({
        where: {
          code: data.couponCode,
          expireDate: {
            gte: new Date()
          },
          userId: user.id
        }
      });

      if (!coupon)
        throw (ERROR(400, 'coupon not found or expired date', 'COUPON_NOT_FOUND'));

      data.couponId = coupon.id;
      data.totalPrice = calculateCouponDiscount(data.totalPrice, coupon);


    } else {
      throw ERROR(604, 'coupon can not be changed', 'COUPON_CAN_NOT_CHANGE');
    }

    // update data 
    await changeOrderProduct(order, tempProduct, warehouseProductCountUpdates);
    delete data.id;
    await order.updateAttributes(data);

    await processEditOrderAward(order.id);



  }


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

    // update order products 
    for (let orderProduct of order.orderProducts()) {

      let product = orderProduct.product();
      let productAbstractId = product.productAbstract().id;
      let warehouse = order.warehouse();
      let warehouseProduct = await warehouse.warehouseProducts({ where: { productAbstractId } });
      warehouseProduct = warehouseProduct[0];
      // update warehouse total count 
      await warehouseProduct.updatetotalCount(- orderProduct.count * product.parentCount, { sellingPrice: orderProduct.sellingPrice });
    }
    // update order prizes 
    for (let orderPrize of order.orderPrizes()) {

      let product = orderPrize.product();
      let productAbstractId = product.productAbstract().id;
      let warehouse = order.warehouse();
      let warehouseProduct = await warehouse.warehouseProducts({ where: { productAbstractId } });
      warehouseProduct = warehouseProduct[0];
      // update warehouse total count 
      await warehouseProduct.updatetotalCount(- orderPrize.count * product.parentCount, { sellingPrice: 0 });
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

    // create installments
    let OutInstallment = {

      userId: user.id,
      orderId: order.id,
      amount: order.totalPrice,
      direction: 'out'

    };

    let InInstallment = {

      userId: user.id,
      orderId: order.id,
      amount: -order.totalPrice,
      direction: 'in'

    };

    await Orders.app.models.installment.create(InInstallment);
    await Orders.app.models.installment.create(OutInstallment);




    order.status = 'delivered';
    order.deliveredDate = new Date();
    await order.save();

    notifications.afterOrderDelivered(order);

    // activate onhold coupons 

    await Orders.app.models.coupons.updateAll({ orderId }, { onhold: false });

    return 'order is delivered';

  }


  Orders.assignOrderToCancel = async function (orderId) {

    let order = await Orders.findById(orderId);

    if (!order)
      throw ERROR(404, 'order not found');

    if (order.status == 'canceled')
      throw ERROR(400, 'the order has been canceled already');

    if (order.status == 'delivered')
      throw ERROR(400, 'order can not be canceled');


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


    await processCancelOrderAward(order.id);


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

  function createReportModels(type, obj, priceModel, countModel) {
    let { minYear, maxYear, minIndex, maxIndex } = obj;

    if (type == "weekly") {
      for (let year = minYear; year <= maxYear; year++) {
        for (let week = (year == minYear ? minIndex : 0); week <= (year == maxYear ? maxIndex : 53); week++) {
          priceModel.push(

            {
              displayName: `Year ${year} Week ${week} `,
              access: `price.${year}.${week}`,
              type: "number",
            }
          );
          countModel.push(
            {
              displayName: `Year ${year} Week ${week} `,
              access: `count.${year}.${week}`,
              type: "number",

            }
          );
        }
      }
    } else if (type == "daily") {

      for (let year = minYear; year <= maxYear; year++) {
        for (let day = (year == minYear ? minIndex : 1); day <= (year == maxYear ? maxIndex : 366); day++) {
          priceModel.push(

            {
              displayName: `Year ${year} Day ${day} `,
              access: `price.${year}.${day}`,
              type: "number",
            }
          );
          countModel.push(

            {
              displayName: `Year ${year} Day ${day} `,
              access: `count.${year}.${day}`,
              type: "number",

            }
          );
        }
      }
    } else if (type == "monthly") {

      for (let year = minYear; year <= maxYear; year++) {
        for (let month = (year == minYear ? minIndex : 1); month <= (year == maxYear ? maxIndex : 12); month++) {
          priceModel.push(

            {
              displayName: `Year ${year} Month ${month} `,
              access: `price.${year}.${month}`,
              type: "number",
            }
          );
          countModel.push(

            {
              displayName: `Year ${year} Month ${month} `,
              access: `count.${year}.${month}`,
              type: "number",

            }
          );
        }
      }
    }
  }

  function createReportFields(data, type, priceModel, countModel, target = 'client') {

    let values = {};
    let index = 'month';
    let minYear = 1e10;
    let maxYear = -1;
    let minIndex = 1e10;
    let maxIndex = -1;


    if (type == "weekly") {
      index = 'week';
    }
    else if (type == "daily") {
      index = 'day';
    } else if (type == "monthly") {
      index = 'month';
    }

    data.forEach(record => {

      let { year } = record;
      let indexValue = record[index];
      let id = target == 'client' ? record.clientId : record.areaId;
      values[id] = values[id] || {};
      if (target == "area")
        values[id]["area"] = record.area.nameAr;
      else
        values[id]["client"] = record.client.shopName;

      values[id][`price.${year}.${indexValue}`] = record.price;
      values[id][`count.${year}.${indexValue}`] = record.count;

      if (year > maxYear) {
        maxYear = year;
        maxIndex = indexValue;
      }
      if (year < minYear) {
        minYear = year;
        minIndex = indexValue;
      }

      if (year == maxYear)
        maxIndex = Math.max(indexValue, maxIndex);

      if (year == minYear)
        minIndex = Math.min(indexValue, minIndex);

    });

    // create columns 
    createReportModels(type, { minYear, maxYear, minIndex, maxIndex }, priceModel, countModel);

    return Object.values(values);
  }

  function areaReport2Xlsx(data, type, cb) {



    let priceModel = [
      {
        displayName: "Area",
        access: "area",
        type: "string"
      },
    ];

    let countModel = [
      {
        displayName: "Area",
        access: "area",
        type: "string"
      },
    ];



    let areas = createReportFields(data, type, priceModel, countModel, 'area');

    let config = {
      path: 'files/excelFiles',
      save: true,
      fileName: `area-report-${Date.now().toString()}.xlsx`,

    };


    let priceSheet = mongoXlsx.mongoData2XlsxData(areas, priceModel);
    let countSheet = mongoXlsx.mongoData2XlsxData(areas, countModel);

    mongoXlsx.mongoData2XlsxMultiPage([priceSheet, countSheet], ["Price", "Count"], config, (err, data) => {
      if (err) cb(err);
      else cb(null, data);
    });

  }

  function clientReport2Xlsx(data, type, cb) {


    let priceModel = [
      {
        displayName: "Client",
        access: "client",
        type: "string"
      },
    ];

    let countModel = [
      {
        displayName: "Client",
        access: "client",
        type: "string"
      },
    ];


    let clients = createReportFields(data, type, priceModel, countModel, 'client');

    let config = {
      path: 'files/excelFiles',
      save: true,
      fileName: `clinet-report-${Date.now().toString()}.xlsx`,

    };


    let priceSheet = mongoXlsx.mongoData2XlsxData(clients, priceModel);
    let countSheet = mongoXlsx.mongoData2XlsxData(clients, countModel);

    mongoXlsx.mongoData2XlsxMultiPage([priceSheet, countSheet], ["Price", "Count"], config, (err, data) => {
      if (err) cb(err);
      else cb(null, data);
    });



  }
  Orders.clientReport = function (res, from, to, type, excel) {

    let and = [];
    if (from)
      and.push({ orderDate: { $gte: from } });

    if (to)
      and.push({ orderDate: { $lte: to } });


    if (and.length)
      and = [{ $match: { $and: and } }];

    let groupId = {
      year: { $year: "$orderDate" },
      clientId: "$clientId"
    };

    if (["weekly", "monthly"].find(x => x == type) == null)
      type = 'monthly';

    if (type == "weekly") {
      groupId.week = { $week: "$orderDate" };
    } else if (type == "monthly") {
      groupId.month = { $month: "$orderDate" };
    }

    let stages =
      [
        ...and,
        {
          $group: {
            _id: groupId,
            price: { $sum: "$totalPrice" },
            count: { $sum: 1 },
          },

        },
        { $sort: { "_id.week": 1, "_id.month": 1, "_id.year": 1, "_id.day": 1 } }
        ,
        {
          $replaceRoot: { newRoot: { $mergeObjects: ["$_id", { price: "$price", count: "$count" }] } }
        },
        {
          $lookup: {
            from: 'user',
            localField: 'clientId',
            foreignField: '_id',
            as: 'client'
          }
        },
        {
          $unwind: "$client"
        }
        /*{
          $group: {
            _id: { "clientId": "$_id.clientId" },
            orders: { $push: "$$ROOT" },
          }
        }*/
      ];


    Orders.getDataSource().connector.collection('orders').aggregate(stages, (err, result) => {
      if (err)
        return res.status(500).json(err);

      if (!excel) {
        return res.json(result);
      }


      clientReport2Xlsx(result, type, (err, data) => {
        if (err)
          return res.status(500).json(err);

        res.sendFile(path.join(__dirname, '../../', data.fullPath))
      });



    });


  }

  Orders.areaReport = function (res, from, to, type, excel) {

    let and = [];
    if (from)
      and.push({ orderDate: { $gte: from } });

    if (to)
      and.push({ orderDate: { $lte: to } });


    if (and.length)
      and = [{ $match: { $and: and } }];

    let groupId = {
      year: { $year: "$orderDate" },
      areaId: "$client.areaId"
    };

    if (["weekly", "monthly", "daily"].find(x => x == type) == null)
      type = "monthly";



    if (type == "weekly") {
      groupId.week = { $week: "$orderDate" };
    } else if (type == "monthly") {
      groupId.month = { $month: "$orderDate" };
    } else if (type == "daily") {
      groupId.month = { $month: "$orderDate" };
      groupId.day = { $dayOfYear: "$orderDate" };
    }

    let stages =
      [
        ...and,
        {
          $lookup: {
            from: 'user',
            localField: 'clientId',
            foreignField: '_id',
            as: 'client'
          }
        },
        {
          $unwind: "$client"
        },
        {
          $group: {
            _id: groupId,
            price: { $sum: "$totalPrice" },
            count: { $sum: 1 },
          },

        },
        { $sort: { "_id.week": 1, "_id.month": 1, "_id.year": 1, "_id.day": 1 } }
        ,
        {
          $replaceRoot: { newRoot: { $mergeObjects: ["$_id", { price: "$price", count: "$count" }] } }
        },
        {
          $lookup: {
            from: 'area',
            localField: 'areaId',
            foreignField: '_id',
            as: 'area'
          }
        },
        {
          $unwind: "$area"
        }
        /*{
          $group: {
            _id: { "clientId": "$_id.clientId" },
            orders: { $push: "$$ROOT" },
          }
        }*/
      ];


    Orders.getDataSource().connector.collection('orders').aggregate(stages, (err, result) => {
      if (err)
        return res.status(500).json(err);

      if (!excel) {
        return res.json(result);
      }

      areaReport2Xlsx(result, type, (err, data) => {
        if (err)
          return res.status(500).json(err);
        res.sendFile(path.join(__dirname, '../../', data.fullPath))
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
