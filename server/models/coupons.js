'use strict';

module.exports = function(Coupons) {
	Coupons.validatesInclusionOf('type', {in: ['fixed', 'percent']});
	Coupons.validatesInclusionOf('status', {in: ['available', 'used']});

	Coupons.beforeRemote('create', function( ctx, modelInstance, next) {
		ctx.req.body.code = generateCodeNumber();
		ctx.req.body.numberOfUsed = 0;
		next();
	});

	var generateCodeNumber = function(){
		return Math.floor(100000 + Math.random() * 900000)
	}
};
