var myConfig = require('../server/myConfig.json');
var OneSignal = require('onesignal-node');
var _ = require('lodash')



var myClient = new OneSignal.Client({
    userAuthKey: myConfig.oneSignalUserAuthKey,
    app: { appAuthKey: myConfig.oneSignalApIKey, appId: myConfig.oneSignalAppId }
});



// module.exports.addNewVolume = function (VolumesModel, volume) {
// 	var allCategories = [];
// 	_.each(volume.posts(),(post)=>{
// 		if(post.categoryId) allCategories.push(post.categoryId);
// 		if(post.subCategoryId) allCategories.push(post.subCategoryId);
// 	});
// 	VolumesModel.getDataSource().connector.collection('user').aggregate([
// 		{ $match: {postCategoriesIds : {$in : allCategories}} },
// 		{ $project: { postCategoriesIds: 1, commonToBoth: { $setIntersection: [ "$postCategoriesIds", allCategories ] }} }
                     
//      ],function(err,users){
//      	if(err)  // TODO Debug
//      		return console.log(err);
//      	_.each(users,function(user){
//      		var message = "add new volume  favoriteCategories: "+user.commonToBoth.toString();
//      		_sendNotification(user._id,message,"addNewVolume")
//      	});
//      })
// }

module.exports.afterOrderDelivered = function(order){
	_sendNotification(order.clientId,order.deliveryMemberId,'orderDelivered',{orderId : order.id});
}


var _sendNotificationToMultiUsers = function(usersIds,actorId,action,object){
	_.each(usersIds,(user)=>{_sendNotification(user._id || user,actorId,action,object)});
}


var _sendNotification = function(userId,actorId,action,object){
	_sendOneSignalNotification(userId,"please rate");

	app.models.notifications.create({
		ownerId : userId,
		actorId : actorId,
		action : action,
		object : object
	},function(err,notification){
		if(err)
			return console.log(err);
		console.log("notification sent",userId, object);
	});
}

var _sendOneSignalNotification = function(userId,message){
	var firstNotification = new OneSignal.Notification({    
    	contents: {    
	        message: message
	    },
	});    
	firstNotification.postBody["filters"] = [{"field": "tag", "key": "userId", "relation": "=", "value": userId}]; 
	myClient.sendNotification(firstNotification, function (err, httpResponse,data) {    
	if (err) {    
	    console.log('Something went wrong...');    
	} else {    
	    console.log(data, httpResponse.statusCode);    
	}    
});   
}