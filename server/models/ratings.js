'use strict';

module.exports = function (Ratings) {
  Ratings.validatesInclusionOf('rate', { in: ['sad', 'normal', 'happy', 'proceed']
});

  Ratings.validatesInclusionOf('status', { in: ['unprocessed', 'processed']
  });

  Ratings.afterRemote('create', function (ctx, result, next) {
    Ratings.app.models.notification.create({
      "type": "rating",
      "ratingId": result.id
    }, function (err, data) {
      if (err)
        return next(err)
      next()
    })
  });

};
