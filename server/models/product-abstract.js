'use strict';

module.exports = function (Productabstract) {

  Productabstract.search = function (string, isOffer, clientType = "", limit = 10, skip = 0, res, cb) {
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
    var clientTypeObject = {
      $or: [{
        availableTo: "both"
      }, {
        availableTo: clientType
      }]
    }
    var statusObject = {
      status: "available",
    }

    if (clientType == "") {
      clientTypeObject = {}
      statusObject = {}
    }
    stages.push({
      $lookup: {
        from: 'manufacturers',
        localField: 'manufacturerId',
        foreignField: '_id',
        as: 'manufacturer'
      }
    }, {
        $match: {
          $and: [statusObject, {
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
          }, clientTypeObject],
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

    Productabstract.getDataSource().connector.collection('productAbstract')
      .aggregate(stages, function (err, products) {
        if (err)
          return cb(err);
        return res.json(products)
      });

  }


};
