var myConfig = require('../server/myConfig.json');
var FCM = require('fcm-node');
var serverKey = myConfig.serverKey; //put your server key here
var fcm = new FCM(serverKey);
var app = require('../server/server');

module.exports.afterOrderDelivered = function (order) {
  _sendNotification(order.clientId, order.deliveryMemberId, 'orderDelivered', {
    orderId: order.id
  });
}

module.exports.orderInDelievery = function (order) {
  _sendNotification(order.clientId, order.deliveryMemberId, 'orderInDelivery', {
    orderId: order.id
  });
}

module.exports.rewardUser = function (order, award) {
  _sendNotification(order.clientId, null, 'rewardUser',
    {
      orderId: order.id,
      awardId: award._id
    });
}


module.exports.sendMultiNot = function (title, body, token) {
  token.forEach(element => {
    var message = { //this may vary according to the message type (single recipient, multicast, topic, et cetera)
      to: element,
      collapse_key: myConfig.senderId,

      notification: {
        title: title,
        body: body,
      }
    };
    console.log(message)
    fcm.send(message, function (err, response) {
      if (err) {
        console.log("Something has gone wrong!");
        console.log(err);
      } else {
        console.log("Successfully sent with response: ", response);
      }
    });
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

  app.models.user.findById(userId, function (err, user) {

    _sendOneSignalNotification(user.fireBaseToken, action, object);
    app.models.Usernotifications.create({
      ownerId: userId,
      actorId: actorId,
      action: action,
      object: object
    }, function (err, notification) {
      if (err)
        return console.log(err);
    });
  })

}


var _sendOneSignalNotification = function (token, action, object) {

  var message = {};


  if (action == 'orderDelivered') {


    message = { //this may vary according to the message type (single recipient, multicast, topic, et cetera)
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


  } else if (action == 'orderInDelivery') {

    message = {
      to: token,
      collapse_key: myConfig.senderId,

      notification: {
        title: 'تم اسناد طلبك لموصل طلبات',
        body: '',
        click_action: "orderInDelivery"
      },

      data: { //you can send only notification or only data(or include both)
        "orderId": object.orderId,
        "openActivity": "orderInDelivery"
      }
    };

  } else if (action == 'rewardUser') {

    message = {
      to: token,
      collapse_key: myConfig.senderId,

      notification: {
        title: 'مبارك ! لقد ربحت جائزة جديدة',
        body: '',
        click_action: "rewardUser"
      },

      data: { //you can send only notification or only data(or include both)
        "orderId": object.orderId,
        "awardId": object.awardId,
        "openActivity": "rewardUser"
      }
    };
  }



  fcm.send(message, function (err, response) {
    if (err) {
      console.log("Something has gone wrong!");
      console.log(err);
    } else {
      console.log("Successfully sent with response: ", response);
    }
  });

}
