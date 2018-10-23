	var hasPrivilage = require('../middleware/hasPrivilage')
module.exports = function (router) {
	router.get('/api/users/',hasPrivilage('getUsers'));
	router.get('/api/users/count',hasPrivilage('countUsers'));
	router.get('/api/users/:id',hasPrivilage('showUser',{id : 'count'}));





	// available to all with no permision
	router.post('/api/users/login',hasPrivilage('ALLOWTOALLUSERS'));
	router.post('/api/users/logout',hasPrivilage('ALLOWTOALLUSERS'));

	// disable All routes exclude above routes
	// router.use('/api',function(req,res,next){
	// 	if(!req.checkPrivilege)
	// 		return next(ERROR(404,'not found OR not allow'));
	// 	return next();
	// });
}