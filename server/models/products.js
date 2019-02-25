'use strict';
var mongoXlsx = require('mongo-xlsx');
var _ = require('lodash');
var async = require('async');
var path = require('path');
module.exports = function (Products) {
  Products.validatesInclusionOf('status', {
    in: ['available', 'unavailable', 'pending']
  });
  // Products.validatesInclusionOf('offerSource', {in: ['dockan', 'company','supplier']});
  Products.validatesInclusionOf('availableTo', {
    in: ['both', 'wholesale', 'horeca']
  });
  Products.validatesPresenceOf('categoryId');

  Products.beforeRemote('create', function (ctx, modelInstance, next) {
    var index = 1;
    _.each(ctx.req.body.offerProducts, (p) => {
      p.id = index++;
    });
    async.parallel([
        _fn('categories', ctx.req.body.categoryId),
        _fn('categories', ctx.req.body.subCategoryId),
        _fn('manufacturers', ctx.req.body.manufacturerId),
      ],
      function (err, results) {
        if (err)
          return next(err);
        ctx.req.body.code = results.join('');
        return next();
      });
  });

  var _fn = function (modelName, value) {
    return function (cb) {
      if (!Products.dataSource.ObjectID.isValid(value))
        return cb(null, '000');
      Products.app.models[modelName].findById(value, function (err, result) {
        if (err)
          return cb(err);
        return cb(null, (result) ? result.code : '000');
      });
    }
  }



  Products.afterRemote('create', function (ctx, result, next) {
    if (!result.isOffer)
      return next();
    if (!result.productsIds || result.productsIds.length == 0)
      return next();
    var offerId = result.id;
    console.log(result.productsIds);
    Products.updateAll({
      _id: {
        in: result.productsIds
      }
    }, {
      $push: {
        offersIds: offerId
      }
    }, function (err, info) {
      if (err)
        console.log(err);
      return next()
    });

  });


  function getRandom(arr, n) {
    var result = new Array(n),
      len = arr.length,
      taken = new Array(len);
    if (n > len)
      return arr;
    while (n--) {
      var x = Math.floor(Math.random() * len);
      result[n] = arr[x in taken ? taken[x] : x];
      taken[x] = --len in taken ? taken[len] : len;
    }
    return result;
  }
  Products.getCategoriesWithProducts = function (limitPerCategory = 10, req, cb) {
    console.log(req.accessToken.userId);
    Products.app.models.user.findById(req.accessToken.userId, function (err, oneUser) {
      if (err)
        return cb(err);
      console.log(oneUser.clientType);
      var clientType = oneUser.clientType;

      Products.getDataSource().connector.collection('products')
        .aggregate([{
            $match: {
              isOffer: false,
              status: "available",
              $or: [{
                availableTo: "both"
              }, {
                availableTo: clientType
              }]
            }
          },
          {
            $sort: {
              categoryId: +1,
            }
          },
          {
            $lookup: {
              from: 'categories',
              localField: 'categoryId',
              foreignField: '_id',
              as: 'category'
            }
          },
          {
            $lookup: {
              from: 'categories',
              localField: 'subCategoryId',
              foreignField: '_id',
              as: 'subCategory'
            }
          },
          {
            $lookup: {
              from: 'manufacturers',
              localField: 'manufacturerId',
              foreignField: '_id',
              as: 'manufacturer'
            }
          },
          {
            $project: {
              "nameAr": 1,
              "nameEn": 1,
              "media": 1,
              "code": 1,
              "sku": 1,
              "pack": 1,
              "description": 1,
              "horecaPrice": 1,
              "wholeSalePrice": 1,
              "wholeSaleMarketPrice": 1,
              "marketPrice": 1,
              "horecaPriceDiscount": 1,
              "wholeSalePriceDiscount": 1,
              "marketOfficialPrice": 1,
              "dockanBuyingPrice": 1,
              "availableTo": 1,
              "isFeatured": 1,
              "status": 1,
              "isOffer": 1,
              "offerSource": 1,
              "offerMaxQuantity": 1,
              "categoryId": 1,
              "subCategoryId": 1,
              "offersIds": 1,
              "id": 1,
              "productsIds": 1,
              "tagsIds": 1,
              "manufacturerId": 1,
              "category": {
                "$arrayElemAt": ["$category", 0]
              },
              "subCategory": {
                "$arrayElemAt": ["$subCategory", 0]
              },
              "manufacturer": {
                "$arrayElemAt": ["$manufacturer", 0]
              }
            }
          },
          {
            $group: {
              _id: '$categoryId',
              info: {
                $first: "$category"
              },
              products: {
                $push: '$$ROOT',
              }
            }
          },
          {
            $project: {
              titleEn: '$info.titleEn',
              titleAr: '$info.titleAr',
              id: '$info._id',
              products: "$products",
              priority: "$info.priority"
              // products: {
              //   $slice: ["$products", 0, limitPerCategory]
              // }
            }
          },
          {
            $sort: {
              priority: -1,
            }
          },
        ], function (err, data) {
          console.log("dataaaaaaaaaaaaaaaa");
          console.log(data);
          _.each(data, function (d) {
            d.products = getRandom(d.products, limitPerCategory)
            //   d.id = d._id
            _.each(d.products, function (p) {
              p.id = p._id
            });
          });
          return cb(err, data);
        });
    })
  }
  Products.remoteMethod('getCategoriesWithProducts', {
    description: 'get products grouped by categories   == 10 product in each category',
    accepts: [{
        arg: 'limit',
        type: 'number',
        'http': {
          source: 'query'
        }
      },
      {
        arg: 'req',
        http: {
          source: 'req'
        }
      }
    ],
    returns: {
      arg: 'body',
      type: 'body',
      root: true
    },
    http: {
      verb: 'get',
      path: '/groupedByCategories'
    },
  });

  Products.getManufacturersWithProducts = function (categoryId, subCategoryId, limitPerManufacturer = 10, req, cb) {
    console.log(req.accessToken.userId);
    Products.app.models.user.findById(req.accessToken.userId, function (err, oneUser) {
      if (err)
        return cb(err);
      console.log(oneUser.clientType);
      var clientType = oneUser.clientType;

      var where = {
        status: "available",
        isOffer: false,
        $or: [{
          availableTo: "both"
        }, {
          availableTo: clientType
        }]
      };
      if (categoryId)
        where.categoryId = Products.dataSource.ObjectID(categoryId);
      if (subCategoryId)
        where.subCategoryId = Products.dataSource.ObjectID(subCategoryId);
      console.log(where);
      Products.getDataSource().connector.collection('products')
        .aggregate([{
            $match: where
          },
          {
            $lookup: {
              from: 'categories',
              localField: 'categoryId',
              foreignField: '_id',
              as: 'category'
            }
          },
          {
            $lookup: {
              from: 'categories',
              localField: 'subCategoryId',
              foreignField: '_id',
              as: 'subCategory'
            }
          },
          {
            $lookup: {
              from: 'manufacturers',
              localField: 'manufacturerId',
              foreignField: '_id',
              as: 'manufacturer'
            }
          },
          {
            $project: {
              "nameAr": 1,
              "nameEn": 1,
              "media": 1,
              "code": 1,
              "sku": 1,
              "pack": 1,
              "description": 1,
              "horecaPrice": 1,
              "wholeSalePrice": 1,
              "wholeSaleMarketPrice": 1,
              "marketPrice": 1,
              "horecaPriceDiscount": 1,
              "wholeSalePriceDiscount": 1,
              "marketOfficialPrice": 1,
              "dockanBuyingPrice": 1,
              "availableTo": 1,
              "isFeatured": 1,
              "status": 1,
              "isOffer": 1,
              "offerSource": 1,
              "offerMaxQuantity": 1,
              "categoryId": 1,
              "subCategoryId": 1,
              "offersIds": 1,
              "productsIds": 1,
              "tagsIds": 1,
              "manufacturerId": 1,
              "category": {
                "$arrayElemAt": ["$category", 0]
              },
              "subCategory": {
                "$arrayElemAt": ["$subCategory", 0]
              },
              "manufacturer": {
                "$arrayElemAt": ["$manufacturer", 0]
              }
            }
          },
          {
            $group: {
              _id: '$manufacturerId',
              info: {
                $first: "$manufacturer"
              },
              products: {
                $push: '$$ROOT'
              }
            }
          },
          {
            $project: {
              nameEn: '$info.nameEn',
              nameAr: '$info.nameAr',
              id: '$info._id',
              products: {
                $slice: ["$products", limitPerManufacturer]
              }
            }
          }
        ], function (err, data) {

          // _.each(data, function (d) {
          // //   d.id = d._id
          //   _.each(d.products, function (p) {
          //     p.id = p._id
          //   });
          // });
          var sortedArray = data.sort((n1, n2) => {
            if (n1.products.length < n2.products.length) {
              return 1;
            }

            if (n1.products.length > n2.products.length) {
              return -1;
            }
            return 0;
          });
          return cb(err, sortedArray);
        });
    })
  }



  Products.remoteMethod('getManufacturersWithProducts', {
    description: 'get products grouped by manufacturer   == 10 product in each manufacturer',
    accepts: [{
        arg: 'categoryId',
        type: 'string',
        'http': {
          source: 'query'
        }
      },
      {
        arg: 'subCategoryId',
        type: 'string',
        'http': {
          source: 'query'
        }
      },
      {
        arg: 'limit',
        type: 'number',
        'http': {
          source: 'query'
        }
      }, {
        arg: 'req',
        http: {
          source: 'req'
        }
      }
    ],
    returns: {
      arg: 'body',
      type: 'body',
      root: true
    },
    http: {
      verb: 'get',
      path: '/groupedByManufacturers'
    },
  });



  Products.similarProduct = function (productId, limit = 10, req, res, cb) {
    console.log(req.accessToken.userId);
    Products.app.models.user.findById(req.accessToken.userId, function (err, oneUser) {
      if (err)
        return cb(err);
      console.log(oneUser.clientType);
      var clientType = oneUser.clientType;
      Products.findById(productId, function (err, product) {
        if (err)
          return cb(err);
        if (!product)
          return cb(ERROR(404, 'product not found'));

        Products.getDataSource().connector.collection('products')
          .aggregate([{
              $match: {
                _id: {
                  $ne: product.id
                },
                tagsIds: {
                  $in: product.tagsIds
                },
                status: "available",
                $or: [{
                  availableTo: "both"
                }, {
                  availableTo: clientType
                }]
              }
            },
            {
              $project: {
                tagsIds: 1,
                rank: {
                  $size: {
                    $setIntersection: ["$tagsIds", product.tagsIds]
                  }
                },
                _id: 0,
                id: "$_id",
                "nameAr": 1,
                "nameEn": 1,
                "media": 1,
                "code": 1,
                "sku": 1,
                "pack": 1,
                "description": 1,
                "horecaPrice": 1,
                "wholeSalePrice": 1,
                "wholeSaleMarketPrice": 1,
                "marketPrice": 1,
                "horecaPriceDiscount": 1,
                "wholeSalePriceDiscount": 1,
                "marketOfficialPrice": 1,
                "dockanBuyingPrice": 1,
                "availableTo": 1,
                "isFeatured": 1,
                "status": 1,
                "isOffer": 1,
                "offerSource": 1,
                "offerMaxQuantity": 1,
                "categoryId": 1,
                "subCategoryId": 1,
                "offersIds": 1,
                "productsIds": 1,
                "tagsIds": 1,
                "manufacturerId": 1
              }
            },
            {
              $sort: {
                rank: -1
              }
            },
            {
              $limit: limit
            },
            {
              $lookup: {
                from: 'categories',
                localField: 'categoryId',
                foreignField: '_id',
                as: 'category'
              }
            },
            {
              $lookup: {
                from: 'categories',
                localField: 'subCategoryId',
                foreignField: '_id',
                as: 'subCategory'
              }
            },
            {
              $lookup: {
                from: 'manufacturers',
                localField: 'manufacturerId',
                foreignField: '_id',
                as: 'manufacturer'
              }
            },
            {
              $project: {
                id: 1,
                "nameAr": 1,
                "nameEn": 1,
                "media": 1,
                "code": 1,
                "sku": 1,
                "pack": 1,
                "description": 1,
                "horecaPrice": 1,
                "wholeSalePrice": 1,
                "wholeSaleMarketPrice": 1,
                "marketPrice": 1,
                "horecaPriceDiscount": 1,
                "wholeSalePriceDiscount": 1,
                "marketOfficialPrice": 1,
                "dockanBuyingPrice": 1,
                "availableTo": 1,
                "isFeatured": 1,
                "status": 1,
                "isOffer": 1,
                "offerSource": 1,
                "offerMaxQuantity": 1,
                "categoryId": 1,
                "subCategoryId": 1,
                "offersIds": 1,
                "productsIds": 1,
                "tagsIds": 1,
                "manufacturerId": 1,
                "category": {
                  "$arrayElemAt": ["$category", 0]
                },
                "subCategory": {
                  "$arrayElemAt": ["$subCategory", 0]
                },
                "manufacturer": {
                  "$arrayElemAt": ["$manufacturer", 0]
                }
              }
            },
          ], function (err, products) {
            if (err)
              return cb(err);
            return res.json(products)
          });
      });
    })
  }


  Products.remoteMethod('similarProduct', {
    accepts: [{
        arg: 'productId',
        type: 'string',
        'http': {
          source: 'query'
        }
      },
      {
        arg: 'limit',
        type: 'number',
        'http': {
          source: 'query'
        }
      },
      {
        arg: 'req',
        http: {
          source: 'req'
        }
      },
      {
        arg: 'res',
        http: {
          source: 'res'
        }
      }
    ],
    http: {
      verb: 'get',
      path: '/similarProduct'
    },
  });
  // app.dataSources.mongoDb
  // .connector.connect(function(err, db) {
  //      db.collection('products').createIndex({ titleAr: "text", titleEn: "text" }, function(err) {
  //      });
  //    })
  Products.search = function (string, isOffer, limit = 10, skip = 0, res, cb) {
    var stages = []
    if (isOffer != undefined)
      stages.push({
        $match: {
          isOffer: isOffer.toLowerCase() == 'true' ? true : false
        }
      });
    var stringArray = []
    if (string != undefined)
      stringArray = string.split(" ");
    console.log(stringArray);
    var nameArMatch = {
      nameAr: {
        $regex: ".*(?i)" + string + ".*"
      }
    }
    var nameEnMatch = {
      nameEn: {
        $regex: ".*(?i)" + string + ".*"
      }
    }

    if (stringArray.length != 0) {
      for (let index = 0; index < stringArray.length; index++) {
        const element = stringArray[index];
        if (index == 0) {
          nameArMatch = {
            $and: [{
              nameAr: {
                $regex: ".*(?i)" + element + ".*"
              }
            }]
          }
          nameEnMatch = {
            $and: [{
              nameEn: {
                $regex: ".*(?i)" + element + ".*"
              }
            }]
          }
        } else {
          nameArMatch["$and"].push({
            nameAr: {
              $regex: ".*(?i)" + element + ".*"
            }
          })
          nameEnMatch["$and"].push({
            nameEn: {
              $regex: ".*(?i)" + element + ".*"
            }
          })
        }
      }
    }
    console.log(nameArMatch);
    console.log(nameEnMatch);
    stages.push({
      $lookup: {
        from: 'manufacturers',
        localField: 'manufacturerId',
        foreignField: '_id',
        as: 'manufacturer'
      }
    }, {
      $match: {
        $or: [
          nameArMatch,
          nameEnMatch,
          {
            'manufacturer.nameEn': {
              $regex: ".*(?i)" + string + ".*"
            }
          },
          {
            'manufacturer.nameAr': {
              $regex: ".*(?i)" + string + ".*"
            }
          },
          {
            tagsIds: {
              $regex: ".*(?i)" + string + ".*"
            }
          },

        ]
      }
    }, {
      $skip: skip
    }, {
      $limit: limit
    }, {
      $lookup: {
        from: 'categories',
        localField: 'categoryId',
        foreignField: '_id',
        as: 'category'
      }
    }, {
      $lookup: {
        from: 'categories',
        localField: 'subCategoryId',
        foreignField: '_id',
        as: 'subCategory'
      }
    }, {
      $project: {
        id: '$_id',
        "nameAr": 1,
        "nameEn": 1,
        "media": 1,
        "code": 1,
        "sku": 1,
        "pack": 1,
        "description": 1,
        "horecaPrice": 1,
        "wholeSalePrice": 1,
        "wholeSaleMarketPrice": 1,
        "marketPrice": 1,
        "horecaPriceDiscount": 1,
        "wholeSalePriceDiscount": 1,
        "marketOfficialPrice": 1,
        "dockanBuyingPrice": 1,
        "availableTo": 1,
        "isFeatured": 1,
        "status": 1,
        "isOffer": 1,
        "offerSource": 1,
        "offerMaxQuantity": 1,
        "categoryId": 1,
        "subCategoryId": 1,
        "offersIds": 1,
        "productsIds": 1,
        "tagsIds": 1,
        "manufacturerId": 1,
        "category": {
          "$arrayElemAt": ["$category", 0]
        },
        "subCategory": {
          "$arrayElemAt": ["$subCategory", 0]
        },
        "manufacturer": {
          "$arrayElemAt": ["$manufacturer", 0]
        }
      }
    });

    Products.getDataSource().connector.collection('products')
      .aggregate(stages, function (err, products) {
        if (err)
          return cb(err);
        return res.json(products)
      });

  }

  Products.remoteMethod('search', {
    accepts: [{
        arg: 'string',
        type: 'string',
        'http': {
          source: 'query'
        }
      },
      {
        arg: 'isOffer',
        type: 'string',
        'http': {
          source: 'query'
        }
      },
      {
        arg: 'limit',
        type: 'number',
        'http': {
          source: 'query'
        }
      },
      {
        arg: 'skip',
        type: 'number',
        'http': {
          source: 'query'
        }
      },
      {
        arg: 'res',
        http: {
          source: 'res'
        }
      }
    ],
    http: {
      verb: 'get',
      path: '/search'
    },
  });


  Products.searchClient = function (string, isOffer, limit = 10, skip = 0, res, req, cb) {
    console.log(req.accessToken.userId);
    Products.app.models.user.findById(req.accessToken.userId, function (err, oneUser) {
      if (err)
        return cb(err);
      console.log(oneUser.clientType);
      var clientType = oneUser.clientType;

      var stages = []
      if (isOffer != undefined)
        stages.push({
          $match: {
            isOffer: isOffer.toLowerCase() == 'true' ? true : false,
            status: "available",
            $or: [{
              availableTo: "both"
            }, {
              availableTo: clientType
            }]
          }
        });
      else {
        stages.push({
          $match: {
            status: "available",
            $or: [{
              availableTo: "both"
            }, {
              availableTo: clientType
            }]
          }
        });
      }

      var stringArray = []
      if (string != undefined)
        stringArray = string.split(" ");
      console.log(stringArray);
      var nameArMatch = {
        nameAr: {
          $regex: ".*(?i)" + string + ".*"
        }
      }
      var nameEnMatch = {
        nameEn: {
          $regex: ".*(?i)" + string + ".*"
        }
      }

      if (stringArray.length != 0) {
        for (let index = 0; index < stringArray.length; index++) {
          const element = stringArray[index];
          if (index == 0) {
            nameArMatch = {
              $and: [{
                nameAr: {
                  $regex: ".*(?i)" + element + ".*"
                }
              }]
            }
            nameEnMatch = {
              $and: [{
                nameEn: {
                  $regex: ".*(?i)" + element + ".*"
                }
              }]
            }
          } else {
            nameArMatch["$and"].push({
              nameAr: {
                $regex: ".*(?i)" + element + ".*"
              }
            })
            nameEnMatch["$and"].push({
              nameEn: {
                $regex: ".*(?i)" + element + ".*"
              }
            })
          }
        }
      }
      console.log(nameArMatch);
      console.log(nameEnMatch);

      stages.push({
        $lookup: {
          from: 'manufacturers',
          localField: 'manufacturerId',
          foreignField: '_id',
          as: 'manufacturer'
        }
      }, {
        $match: {
          $or: [nameArMatch,
            nameEnMatch,
            {
              'manufacturer.nameEn': {
                $regex: ".*(?i)" + string + ".*"
              }
            },
            {
              'manufacturer.nameAr': {
                $regex: ".*(?i)" + string + ".*"
              }
            },
            {
              tagsIds: {
                $regex: ".*(?i)" + string + ".*"
              }
            },

          ]
        }
      }, {
        $skip: skip
      }, {
        $limit: limit
      }, {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category'
        }
      }, {
        $lookup: {
          from: 'categories',
          localField: 'subCategoryId',
          foreignField: '_id',
          as: 'subCategory'
        }
      }, {
        $project: {
          id: '$_id',
          "nameAr": 1,
          "nameEn": 1,
          "media": 1,
          "code": 1,
          "sku": 1,
          "pack": 1,
          "description": 1,
          "horecaPrice": 1,
          "wholeSalePrice": 1,
          "wholeSaleMarketPrice": 1,
          "marketPrice": 1,
          "horecaPriceDiscount": 1,
          "wholeSalePriceDiscount": 1,
          "marketOfficialPrice": 1,
          "dockanBuyingPrice": 1,
          "availableTo": 1,
          "isFeatured": 1,
          "status": 1,
          "isOffer": 1,
          "offerSource": 1,
          "offerMaxQuantity": 1,
          "categoryId": 1,
          "subCategoryId": 1,
          "offersIds": 1,
          "productsIds": 1,
          "tagsIds": 1,
          "manufacturerId": 1,
          "category": {
            "$arrayElemAt": ["$category", 0]
          },
          "subCategory": {
            "$arrayElemAt": ["$subCategory", 0]
          },
          "manufacturer": {
            "$arrayElemAt": ["$manufacturer", 0]
          }
        }
      });

      Products.getDataSource().connector.collection('products')
        .aggregate(stages, function (err, products) {
          if (err)
            return cb(err);
          return res.json(products)
        });
    })
  }

  Products.remoteMethod('searchClient', {
    accepts: [{
        arg: 'string',
        type: 'string',
        'http': {
          source: 'query'
        }
      },
      {
        arg: 'isOffer',
        type: 'string',
        'http': {
          source: 'query'
        }
      },
      {
        arg: 'limit',
        type: 'number',
        'http': {
          source: 'query'
        }
      },
      {
        arg: 'skip',
        type: 'number',
        'http': {
          source: 'query'
        }
      },
      {
        arg: 'res',
        http: {
          source: 'res'
        }
      },
      {
        arg: 'req',
        http: {
          source: 'req'
        }
      }
    ],
    http: {
      verb: 'get',
      path: '/searchClient'
    },
  });

  /**
   *
   * @param {boolean} isFeatured
   * @param {Function(Error, array)} callback
   */

  Products.getOffers = function (isFeatured, req, callback) {
    var result;
    console.log(isFeatured);
    Products.app.models.user.findById(req.accessToken.userId, function (err, oneUser) {
      if (err)
        return callback(err);
      var clientType = oneUser.clientType;
      var where = {}
      if (isFeatured == undefined)
        where = {
          "and": [{
              "status": "available"
            },
            {
              "isOffer": true,
            },
            {
              "or": [{
                  "availableTo": "both"
                },
                {
                  "availableTo": clientType
                }
              ]
            }
          ]
        };
      else {
        if (isFeatured == "true")
          isFeatured = true
        else if (isFeatured == "false")
          isFeatured = false
        where = {
          "and": [{
              "status": "available"
            },
            {
              "isOffer": true,
            },
            {
              "isFeatured": isFeatured
            }, {
              "or": [{
                  "availableTo": "both"
                },
                {
                  "availableTo": clientType
                }
              ]
            }
          ]
        };
      }
      Products.find({
        "where": where
      }, function (err, products) {
        if (err)
          return callback(err, null)
        callback(err, products)
      })
    })
  };

  Products.getOffersByProdId = function (productId, req, callback) {
    var result;
    Products.app.models.user.findById(req.accessToken.userId, function (err, oneUser) {
      if (err)
        return callback(err);
      var clientType = oneUser.clientType;
      console.log("clientType")
      console.log(clientType)
      var where = {}
      Products.findById(productId, function (err, product) {
        if (err)
          return callback(err, null)
        where = {
          "and": [{
              "status": "available"
            },
            {
              "isOffer": true,
            },
            {
              "id": {
                "inq": product.offersIds
              }
            },
            {
              "or": [{
                  "availableTo": "both"
                },
                {
                  "availableTo": clientType
                }
              ]
            }
          ]
        };
        Products.find({
          "where": where
        }, function (err, offers) {
          if (err)
            return callback(err, null)
          callback(err, offers)

        })

      })
    })
  };


  Products.exportProducts = function (res, cb) {
    Products.find({
      /*where : {status : 'available'}*/
    }, function (err, data) {
      var config = {
        path: 'files/excelFiles',
        save: true,
        fileName: 'products' + Date.now() + '.xlsx'
      };
      model[0].access = 'id';
      mongoXlsx.mongoData2Xlsx(data, model, config, function (err, data) {
        console.log('File saved at:', path.join(__dirname, '../../', data.fullPath), data.fullPath);
        return res.sendFile(path.join(__dirname, '../../', data.fullPath))
      });
    });
  }


  Products.remoteMethod('exportProducts', {
    description: 'export products to excel file',
    accepts: [{
      arg: 'res',
      http: {
        source: 'res'
      }
    }],
    http: {
      verb: 'get',
      path: '/exportProducts'
    },
  });




  Products.importProducts = function (fileUrl, res, cb) {
    model[0].access = '_id';
    var fileName = path.basename(fileUrl);
    mongoXlsx.xlsx2MongoData(path.join(__dirname, '../../files/excelFiles', fileName), model, {}, function (err, rows) {
      if (err)
        return cb(err);
      var newRecords = [];

      var batch = Products.dataSource.adapter.collection('products').initializeUnorderedBulkOp();

      _.each(rows, function (row) {
        try {
          row._id = Products.dataSource.ObjectID(row._id)
        } catch (e) {
          row._id = Products.dataSource.ObjectID()
        };
        if (row.manufacturerId) try {
          row.manufacturerId = Products.dataSource.ObjectID(row.manufacturerId)
        } catch (e) {
          delete row.manufacturerId
        };
        if (row.categoryId) try {
          row.categoryId = Products.dataSource.ObjectID(row.categoryId)
        } catch (e) {
          delete row.categoryId
        };
        if (row.subCategoryId) try {
          row.subCategoryId = Products.dataSource.ObjectID(row.subCategoryId)
        } catch (e) {
          delete row.subCategoryId
        };
        if (row.tagsIds) try {
          row.tagsIds = JSON.parse(row.tagsIds)
        } catch (e) {
          delete row.tagsIds
        };
        if (row.offerProducts) try {
          row.offerProducts = JSON.parse(row.offerProducts)
        } catch (e) {
          delete row.offerProducts
        };
        if (row.offersIds) try {
          row.offersIds = JSON.parse(row.offersIds)
        } catch (e) {
          delete row.offersIds
        };
        batch.find({
          _id: row._id
        }).upsert().updateOne(row);
      });
      batch.execute(function (err, result) {
        if (err)
          return cb(err);
        res.json({
          nMatched: result.nMatched,
          nInserted: result.nUpserted,
          nModified: result.nModified
        })
      });
    })
  }
  Products.remoteMethod('importProducts', {
    description: 'import products from excel file',
    accepts: [{
        arg: 'fileUrl',
        type: 'string',
        description: 'url  file after uploaded on api/attachments/excelFiles/upload'
      },
      {
        arg: 'res',
        http: {
          source: 'res'
        }
      }
    ],
    http: {
      verb: 'post',
      path: '/importProducts'
    },
  });


  function setIsFavorite(result, ctx, cb) {
    // return new Promise(function (resolve, reject) {
    // const currentCtx = LoopBackContext.getCurrentContext();
    // const locals = currentCtx ? currentCtx.get('http').res.locals : 0;

    const accessToken = ctx.req.accessToken;
    if (ctx.req.accessToken && ctx.req.accessToken.userId) {
      Products.app.models.favorite.find({
        where: {
          ownerId: accessToken.userId
        }
      }, function (err, products) {
        if (err)
          cb(err);
        const favoritesIds = products.map(function (product) {
          return product.productId;
        });
        console.log("favoritesIds");
        console.log(favoritesIds);
        if (Array.isArray(result)) {
          result = result.map(res => {
            //console.log("");
            // console.log(bookmarksIds[0]);
            res.isFavorite = favoritesIds.findIndex(o => o.toString() === res.id.toString()) !== -1;
            return res;
          });
          // console.log(result);
          cb(null, result);
        } else {
          console.log("favoritesIds");
          console.log(favoritesIds);
          console.log("result")
          console.log(result)
          result.isFavorite = favoritesIds.findIndex(o => o.toString() === result.id.toString()) !== -1;
          cb(null, result);
        }
      })
    } else {
      cb(null, result);
    }
    // });
  }



  Products.afterRemote('find', function (context, user, next) {
    setIsFavorite(context.result, context, function (err, data) {
      if (err)
        return next(err);
      context.result = data;
      next()
    })
    // setIsFavorite(context.result, context).then(result => {
    //   context.result = result;
    //   next();
    // }).catch(err => next(err));
    // next();
  });
  Products.afterRemote('findById', function (context, user, next) {
    setIsFavorite(context.result, context, function (err, data) {
      if (err)
        return next(err);
      context.result = data;
      next()
    })

  });

  /**
   *
   * @param {Function(Error, array)} callback
   */

  Products.productsFeatured = function (req, callback) {
    var result;
    console.log(req.accessToken.userId);
    Products.app.models.user.findById(req.accessToken.userId, function (err, oneUser) {
      if (err)
        return cb(err);
      console.log(oneUser.clientType);
      var clientType = oneUser.clientType;

      Products.find({
        "where": {
          "and": [{
              "isOffer": "false"
            },
            {
              "isFeatured": "true"
            },
            {
              "status": "available",
            },
            {
              "or": [{
                "availableTo": "both"
              }, {
                "availableTo": clientType
              }]
            }
          ]
        }
      }, function (err, data) {
        if (err)
          return callback(err, null);
        callback(null, data);
      })


    })
  };



  /**
   *
   * @param {string} manufacturerId
   * @param {Function(Error, array)} callback
   */

  Products.productsManufacturer = function (manufacturerId, req, callback) {
    var result;
    console.log(req.accessToken.userId);
    Products.app.models.user.findById(req.accessToken.userId, function (err, oneUser) {
      if (err)
        return cb(err);
      console.log(oneUser.clientType);
      var clientType = oneUser.clientType;

      Products.find({
        "where": {
          "and": [{
              "manufacturerId": manufacturerId
            },
            {
              "status": "available",

            },
            {
              "or": [{
                "availableTo": "both"
              }, {
                "availableTo": clientType
              }]
            }
          ]
        }
      }, function (err, data) {
        if (err)
          return callback(err, null);
        callback(null, data);
      })

    })
  };

  /**
   *
   * @param {string} id
   * @param {Function(Error, object)} callback
   */

  Products.solveMedia = function (id, callback) {
    var data;
    // Products.find({}, function (err, data) {
    //   console.log("data.length");
    //   console.log(data.length);
    //   for (var index = 0; index < data.length; index++) {

    //     // console.log(data[index].media.thumbnail)
    //     var temp = data[index].media.thumbnail;
    //     if (temp.indexOf("/images/") != -1) {

    //       temp = temp.replace("/images/", "/thumb/");
    //       if (temp.indexOf(".png") != -1) {
    //         temp = temp.replace(".png", "_thumb.jpg");

    //       } else if (temp.indexOf(".jpg") != -1) {
    //         temp = temp.replace(".jpg", "_thumb.jpg");
    //       }
    //       // console.log(temp)
    //       data[index].media.thumbnail = temp;
    //       data[index].save();
    //       // callback(null, data);
    //     }
    //   }
    // })
    // Products.find({}, function (err, data) {
    //   console.log("data.length");
    //   console.log(data.length);
    //   var count = 0;
    //   for (var index = 0; index < data.length; index++) {

    //     // console.log(data[index].media.thumbnail)
    //     var temp = data[index].media.thumbnail;
    //     if (temp == null) {
    //       count++;
    //       console.log(count);
    //       temp = data[index].media.url;
    //       temp = temp.replace("/images/", "/thumb/");
    //       if (temp.indexOf(".png") != -1) {
    //         temp = temp.replace(".png", "_thumb.jpg");
    //       }
    //       data[index].media.thumbnail = temp;
    //       data[index].save();
    //       // callback(null, data);
    //     }
    //   }
    // })

    Products.destroyAll({
      "wholeSalePriceDiscount": 1
    }, function (err, data) {
      if (err)
        return callback(err)
      callback(err, data)
    })

  };
};



// for import/export Excel
var model = [{
    displayName: "ID",
    access: "_id",
    type: "string"
  },
  {
    displayName: "code",
    access: "code",
    type: "string"
  },
  {
    displayName: "sku",
    access: "sku",
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
    displayName: "horeca price / before offer",
    access: "horecaPrice",
    type: "number"
  },
  {
    displayName: "wholeSale price / before offer",
    access: "wholeSalePrice",
    type: "number"
  },
  {
    displayName: "wholeSale market price",
    access: "wholeSaleMarketPrice",
    type: "number"
  },
  {
    displayName: "market official price",
    access: "marketOfficialPrice",
    type: "number"
  },
  {
    displayName: "dockan buying price",
    access: "dockanBuyingPrice",
    type: "number"
  },
  {
    displayName: "horeca Price discount / after offer",
    access: "horecaPriceDiscount",
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
    displayName: "offer products",
    access: "offerProducts",
    type: "string"
  },
  {
    displayName: "related Offers",
    access: "offersIds",
    type: "string"
  },
]
