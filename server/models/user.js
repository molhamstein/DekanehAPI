'use strict';
var _ = require('lodash');
module.exports = function(User) {
	User.validatesUniquenessOf('phoneNumber',{message: 'phoneNumber already exists'});
	// User.validatesNumericalityOf('phoneNumber');
	User.validatesInclusionOf('gender', {in: ['male', 'female']});
	User.validatesInclusionOf('status', {in: ['pending', 'activated','deactivated']});
	User.validatesInclusionOf('clientType', {in: ['wholesale', 'retailCostumer']});

	// Hidden Function
	// var functionsDisable = ['__count__accessToken']
	// _.each(functionsDisable,(f)=>{
	// 	User.disableRemoteMethod(f, false);
	// })


	User.afterRemote('*.__link__roles', function(context, role, next) {
		var user  = context.instance;
		user.privilegeIds = _.union(user.privilegeIds,role.privilegeIds);
		user.save(next)
	});

	User.afterRemote('*.__unlink__roles', function(context, undefined, next) {
		var user  = context.instance;
		var roleId = context.req.params.fk;
		User.app.models.role.findById(roleId,(err,role)=>{
			_.pullAll(user.privilegeIds,role.privilegeIds);
			user.save(next)
		});
	});
};
