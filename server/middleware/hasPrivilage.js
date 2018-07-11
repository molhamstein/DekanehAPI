var parseToken = require('loopback').token()

module.exports = function(name) {
	return function(req, res, next) {
		var userModel = req.app.models.user;
		parseToken(req,res,()=>{
	     	if (!req.accessToken){
		     	var err = new Error('Authorization Required');
		        err.statusCode = 401;
		        err.code = 'AUTHORIZATION_REQUIRED';
		        return next(err);
	     	}
	     	userModel.findById(req.accessToken.userId, function(err, user) {
			    if (err) return next(err);
			    if (!user) return next(new Error('No user with this access token was found.'));
			    req.user = user
	     		
	     		return res.json(user)
			});

	     	
		});
	  }
};