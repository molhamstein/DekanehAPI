var hasPrivilage = require('../middleware/hasPrivilage')
module.exports = function (router) {
	router.get('/api/users/',hasPrivilage('getUsers'));
	router.get('/api/users/count',hasPrivilage('countUsers'));
	router.get('/api/users/:id',hasPrivilage('showUser',{id : 'count'}));
}