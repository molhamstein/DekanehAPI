var myConfig = require('../server/myConfig.json');
var FCM = require('fcm-node');
var serverKey = myConfig.serverKey; //put your server key here
var fcm = new FCM(serverKey);
var app = require('../server/server');

// var OneSignal = require('onesignal-node');
// var _ = require('lodash')



// var myClient = new OneSignal.Client({
//     userAuthKey: myConfig.oneSignalUserAuthKey,
//     app: { appAuthKey: myConfig.oneSignalApIKey, appId: myConfig.oneSignalAppId }
// });



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

module.exports.afterOrderDelivered = function (order) {
  _sendNotification(order.clientId, order.deliveryMemberId, 'orderDelivered', {
    orderId: order.id
  });
}

module.exports.me = function () {
  _sendNotification("5be81952d58076492d990061", "", 'orderDelivered', {
    orderId: "5c0fc659ea8ae83168b93673"
  });
}


var _sendNotificationToMultiUsers = function (usersIds, actorId, action, object) {
  _.each(usersIds, (user) => {
    _sendNotification(user._id || user, actorId, action, object)
  });
}


var _sendNotification = function (userId, actorId, action, object) {
  console.log("qwe123", userId);
  app.models.user.findById(userId, function (err, user) {

    _sendOneSignalNotification(user.fireBaseToken, "please rate", object);

    app.models.Usernotifications.create({
      ownerId: userId,
      actorId: actorId,
      action: action,
      object: object
    }, function (err, notification) {
      if (err)
        return console.log(err);
      console.log("notification sent", userId, object);
    });
  })

}


var _sendOneSignalNotification = function (token, message, object) {
  //   var firstNotification = new OneSignal.Notification({
  //     contents: {
  //       en: message
  //     },
  //   });
  //   firstNotification.postBody["filters"] = [{
  //     "field": "tag",
  //     "key": "user_id",
  //     "relation": "=",
  //     "value": userId
  //   }];
  //   firstNotification.postBody["data"] = {
  //     "orderId": object.orderId,
  //     "openActivity": "rating"
  //   };

  //   myClient.sendNotification(firstNotification, function (err, httpResponse, data) {
  //     if (err) {
  //       console.log('Something went wrong...');
  //     } else {
  //       console.log(data, httpResponse.statusCode);
  //     }
  //   });
  var message = { //this may vary according to the message type (single recipient, multicast, topic, et cetera)
    to: token,
    collapse_key: myConfig.senderId,

    notification: {
      title: 'تم توصيل طلبك بنجاح',
      body: 'أعطنا رأيك بخدمات دُكّان',
      click_action: "rating"

    },

    data: { //you can send only notification or only data(or include both)
      "orderId": object.orderId,
      "openActivity": "rating"
    }
  };


  fcm.send(message, function (err, response) {
    if (err) {
      console.log("Something has gone wrong!");
      console.log(err);
    } else {
      console.log("Successfully sent with response: ", response);
    }
  });

}
