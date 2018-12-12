'use strict';

module.exports = function (Favorite) {
  Favorite.beforeRemote('create', function (ctx, modelInstance, next) {
    ctx.req.body.ownerId = ctx.req.accessToken.userId;
    Favorite.find({
      where: ctx.req.body
    }, function (err, favorite) {
      console.log(ctx.req.body);
      console.log(favorite);
      if (err)
        return next(err)
      if (favorite[0])
        return next(ERROR(600, 'already in favorit'))
      next()
    })
  })




  /**
   *
   * @param {string} productId
   * @param {Function(Error, object)} callback
   */

  Favorite.deleteFavorite = function (productId, req, callback) {
    var result;
    // TODO
    var userId = req.accessToken.userId;
    console.log("productId")
    console.log(productId)
    console.log("userId")
    console.log(userId)
    Favorite.destroyAll({
      "productId": productId,
      "ownerId": userId
    }, function (err, data) {
      if (err)
        return callback(err, null);
      if (data.count == 0)
        return callback(ERROR(601, 'no favorite'))
      return callback(null, "")

    })
  };
  /**
   *
   * @param {Function(Error, array)} callback
   */

  Favorite.listofFavorite = function (req, callback) {
    var result;
    // TODO
    Favorite.find({
      where: {
        ownerId: req.accessToken.userId
      }
    }, function (err, products) {
      if (err)
        resolve(err);
      const favoritesIds = products.map(function (product) {
        return product.productId;
      });
      Favorite.app.models.user.findById(req.accessToken.userId, function (err, user) {
        console.log(user.clientType);
        Favorite.app.models.products.find({
          "where": {
            "and": [{
                "id": {
                  inq: favoritesIds
                }
              },
              {
                "or": [{
                    availableTo: "both"
                  },
                  {
                    availableTo: user.clientType
                  }
                ]
              }
            ]
          }
        }, function (err, products) {
          console.log(favoritesIds)
          console.log(products.length)
          callback(null, products);
        })
      })
    })
  };


};
