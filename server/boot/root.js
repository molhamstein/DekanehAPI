'use strict';
var loopback = require('loopback')
module.exports = function(server) {
  // Install a `/` route that returns server status
  global.ERROR = function(statusCode,message,code){
	var err = new Error(message);
	err.statusCode = statusCode;
	err.code = code || (message.replace(/ /g, '_').toUpperCase());
	return err;
  }

  
  var router = server.loopback.Router();
  router.use(loopback.token())
  router.use(function(req,res,next){
    if(!req.accessToken) 
      return next();

    server.models.User.findById(req.accessToken.userId, function(err, user) {
      if(err) 
        return next(err);
      if (!user) 
        return next(ERORR(500,'token expire date'));
      req.user = user;
      return next();
    });
  });

  
  router.get('/', server.loopback.status());
  server.use(router);


};
