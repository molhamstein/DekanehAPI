'use strict';

module.exports = function (Coupons) {
  Coupons.validatesInclusionOf('type', { in: ['fixed', 'percent']
  });
  Coupons.validatesInclusionOf('status', { in: ['available', 'used','deactivated']
  });

  Coupons.beforeRemote('create', function (ctx, modelInstance, next) {
    ctx.req.body.code = generateCodeNumber();
    ctx.req.body.numberOfUsed = 0;
    next();
  });

  var generateCodeNumber = function () {
    return Math.floor(100000 + Math.random() * 900000)
  }

  /**
   *
   * @param {number} code
   * @param {Function(Error)} callback
   */

  Coupons.useCoupon = function (code, req, callback) {
    Coupons.findOne({
      "where": {
        "code": code,
        "expireDate": {
          gte: new Date()
        }
      }
    }, function (err, coupon) {
      if (err)
        return next(err);
      if (!coupon)
        return callback(ERROR(605, 'coupon not found or expired date', 'COUPON_NOT_FOUND'));
      if (coupon.status == 'used' || coupon.userId != null) {
        return callback(ERROR(606, 'coupon is used', 'COUPON_NOT_AVAILABLE'));
      }
      coupon.userId=req.accessToken.userId
      coupon.save();
      callback(null, coupon)
    })
  };
};
