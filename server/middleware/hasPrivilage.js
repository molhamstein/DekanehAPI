var _ = require('lodash');
var parseToken = require('loopback').token()

module.exports = function(name,exclude) {

	return function(req, res, next) {
		req.checkPrivilege = true;

		if(name == 'ALLOWTOALLUSERS')
			return next();

		var isExclude = false;
		if(exclude)
			_.each(exclude,(value,param)=>{if(req.params[param] == value) isExclude = true});
		if(isExclude)
			return next();

		
		console.log(name);
		var userModel = req.app.models.user;
		parseToken(req,res,()=>{
	     	if (!req.accessToken)
			    	return next(ERROR(403,'Authentication required'));
	     	
	     	userModel.findById(req.accessToken.userId, function(err, user) {
			    if (err) return next(err);
			    if (!user) return next(new Error('No user with this access token was found.'));
			    
			    req.user = user;

			    // editUser & showUser
	     		if(req.accessToken.userId == req.params.id)
	     			return next();
	     		
			    if(!user.hasPrivilege(name))
			    	return next(ERROR(401,'authorization required'));
	     		
	     		return next();
			});

	     	
		});
	  }
};