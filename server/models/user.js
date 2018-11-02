'use strict';
var _ = require('lodash');
var g = require('strong-globalize')();
var debug = require('debug')('loopback:user');

module.exports = function(User) {
	User.validatesUniquenessOf('phoneNumber',{message: 'phoneNumber already exists'});
	// user.validatesLengthOf('phoneNumber', {min: 9,max: 10 message: {min: 'phoneNumber is not syrian Number'}});
	User.validatesInclusionOf('status', {in: ['pending', 'activated','deactivated']});
	User.validatesInclusionOf('clientType', {in: ['wholesale', 'horeca']});

	User.prototype.hasPrivilege = function(privilegeName){
		// console.log(privilegeName)
		// TODO
		// return _.includes(this.privilegeIds, privilegeName);
		return true;
	}


	// Hidden Function
	// var functionsDisable = ['__count__accessToken']
	// _.each(functionsDisable,(f)=>{
	// 	User.disableRemoteMethod(f, false);
	// })

	// User.beforeRemote('create', function(ctx, modelInstance, next) {
	// 	ctx.req.body.phoneNumber = Number(ctx.req.body.phoneNumber)
	//     next();
	// });

	User.login = function(credentials, include, fn){
		var self = this;
	    if (typeof include === 'function') {
	      fn = include;
	      include = undefined;
	    }

	    fn = fn || utils.createPromiseCallback();

	    include = (include || '');
	    if (Array.isArray(include)) {
	      include = include.map(function(val) {
	        return val.toLowerCase();
	      });
	    } else {
	      include = include.toLowerCase();
	    }


	    var query = {
	    	phoneNumber : credentials.phoneNumber   
	    }
	    
	    if (!query.phoneNumber) {
	      var err2 = new Error(g.f('{{phoneNumber}} is required'));
	      err2.statusCode = 400;
	      err2.code = 'PHONENUMBER_REQUIRED';
	      fn(err2);
	      return fn.promise;
	    }

	    self.findOne({where: query}, function(err, user) {
	      console.log(query,err,user);
	      var defaultError = new Error(g.f('login failed'));
	      defaultError.statusCode = 401;
	      defaultError.code = 'LOGIN_FAILED';

	      function tokenHandler(err, token) {
	        if (err) return fn(err);
	        if (Array.isArray(include) ? include.indexOf('user') !== -1 : include === 'user') {
	          // NOTE(bajtos) We can't set token.user here:
	          //  1. token.user already exists, it's a function injected by
	          //     "AccessToken belongsTo User" relation
	          //  2. ModelBaseClass.toJSON() ignores own properties, thus
	          //     the value won't be included in the HTTP response
	          // See also loopback#161 and loopback#162
	          token.__data.user = user;
	        }
	        fn(err, token);
	      }

	      if (err) {
	        debug('An error is reported from User.findOne: %j', err);
	        fn(defaultError);
	      } else if (user) {
	        user.hasPassword(credentials.password, function(err, isMatch) {
	          if (err) {
	            debug('An error is reported from User.hasPassword: %j', err);
	            fn(defaultError);
	          } else if (isMatch) {
	            
	            if (user.createAccessToken.length === 2) {
	                user.createAccessToken(credentials.ttl, tokenHandler);
	            } else {
	                user.createAccessToken(credentials.ttl, credentials, tokenHandler);
	            }
	            
	          } else {
	            debug('The password is invalid for user %s', query.email || query.username);
	            fn(defaultError);
	          }
	        });
	      } else {
	        debug('No matching record is found for user %s', query.email || query.username);
	        fn(defaultError);
	      }
	    });
	    return fn.promise;
	}



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




	User.staffLogin = function(email,password,fn){
		var self = this;
	   
	    var query = {
	    	email : email   
	    }
	    
	    if (!query.email) {
	      var err2 = new Error(g.f('{{email}} is required'));
	      err2.statusCode = 400;
	      err2.code = 'EMAIL_REQUIRED';
	      return fn(err)
	    }

	    self.findOne({where: query}, function(err, user) {
	      var defaultError = new Error(g.f('login failed'));
	      defaultError.statusCode = 401;
	      defaultError.code = 'LOGIN_FAILED';

	      function tokenHandler(err, token) {
	        if (err) 
	        	return fn(err);
	        var response ={
	        	ttl : token.ttl,
	        	userId : token.userId,
	        	created : token.created,
	        	id : token.id,
	        	user : user
	        };

	        fn(err, response);
	      }

	      if (err) {
	        debug('An error is reported from User.findOne: %j', err);
	        return fn(defaultError);
	      } else if (user) {
	        user.hasPassword(password, function(err, isMatch) {
	          if (err) {
	            debug('An error is reported from User.hasPassword: %j', err);
	            return fn(defaultError);
	          } else if (isMatch) {
	            
	            if (user.createAccessToken.length === 2) {
	                user.createAccessToken(undefined, tokenHandler);
	            } else {
	                user.createAccessToken(undefined, {email : email, password : password}, tokenHandler);
	            }
	            
	          } else {
	            debug('The password is invalid for user %s', query.email || query.username);
	            return fn(defaultError);
	          }
	        });
	      } else {
	        debug('No matching record is found for user %s', query.email);
	        return fn(defaultError);
	      }
	    });
	    console.log("Done");
	    return fn.promise;
	}
	User.remoteMethod('staffLogin', {
    	description: 'staff user login',
		accepts: [
			{arg: 'email', type: 'string', required: true, http: {source: 'form'}},
			{arg: 'password', type: 'string', required: true, http: {source: 'form'}},
		],
		returns: {arg: 'body', type: 'body',root: true},
		http: {verb: 'post',path: '/staffLogin'},
    });
};
