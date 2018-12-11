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
        return product.productsId;
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
