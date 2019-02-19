'use strict';
var _ = require('lodash');
var g = require('strong-globalize')();
var debug = require('debug')('loopback:user');


var notifications = require('../notifications');

// var api_key = '350a0669476394ed0d32ade7504d5ef9-b3780ee5-89ff6db1';
// var domain = 'sandbox7cbb988bb71e4787b8f7c8ef04db3d04.mailgun.org';
// var mailgun = require('mailgun-js')({
//   apiKey: api_key,
//   domain: domain
// });


module.exports = function (User) {


  // var data = {
  //   from: 'Excited User <anasalazmeh.95@gmail.com>',
  //   to: 'world.of.anas.95@gmail.com',
  //   // to: 'orfali.ayham@gmail.com',
  //   subject: 'Hello',
  //   text: 'Testing some Mailgun awesomeness!'
  // };

  // mailgun.messages().send(data, function (error, body) {
  //   console.log(body);
  // });

  // User.validatesUniquenessOf('phoneNumber', {
  //   message: 'phoneNumber already exists'
  // });
  // user.validatesLengthOf('phoneNumber', {min: 9,max: 10 message: {min: 'phoneNumber is not syrian Number'}});
  User.validatesInclusionOf('status', {
    in: ['pending', 'activated', 'deactivated']
  });
  User.validatesInclusionOf('clientType', {
    in: ['wholesale', 'horeca']
  });

  User.prototype.hasPrivilege = function (privilegeName) {
    // console.log(privilegeName)
    // TODO
    // return _.includes(this.privilegeIds, privilegeName);
    return true;
  }


  /**
   * add notification to admin to reset password
   * @param {Function(Error, string)} callback
   */

  User.forgetpassword = function (phoneNumber, callback) {
    var result;
    User.findOne({
      "where": {
        "phoneNumber": phoneNumber
      }
    }, function (err, user) {
      if (err)
        return callback(err, user)
      if (user == null)
        return callback(ERROR(603, 'phonenumber is wrong'))
      var userId = user.id
      User.app.models.notification.create({
        "type": "forgetPassword",
        "clientId": userId
      }, function (err, data) {
        if (err)
          return callback(err)
        callback(null, "done");
      })
    })

  };

  /**
   *
   * @param {Function(Error, string)} callback
   */

  User.resetPassword = function (id, password, callback) {
    var result;
    User.findById(id, function (err, oneUser) {
      if (err)
        return callback(err, null);
      if (oneUser == null)
        return callback(ERROR(604, 'user not found'))

      oneUser.updateAttribute('password', User.hashPassword(password), function (err, user) {
        if (err)
          return callback(err, null);
        return callback(null, "Done");

      });


    })
    // TODO
    // User.updateAttribute('password', User.hashPassword(req.body.password), function (err, user) {

    // });
  };



  // Hidden Function
  // var functionsDisable = ['__count__accessToken']
  // _.each(functionsDisable,(f)=>{
  // 	User.disableRemoteMethod(f, false);
  // })
  User.beforeRemote('create', function (ctx, modelInstance, next) {
    var phoneNumber = ctx.req.body.phoneNumber;
    User.find({
      "where": {
        "phoneNumber": phoneNumber
      }
    }, function (err, user) {
      if (err)
        return next(err);
      if (user[0] != null)
        return next(ERROR(610, 'user already exists'));
      else
        next()
    })

  })
  User.afterRemote('create', function (ctx, result, next) {
    User.app.models.notification.create({
      "type": "client",
      "clientId": result.id
    }, function (err, data) {
      if (err)
        return next(err)
      next()
    })
  });

  /**
   *
   * @param {string} token
   * @param {Function(Error, string)} callback
   */

  User.setFirebaseToken = function (token, req, callback) {
    var result;
    console.log("req.accessToken.userId");
    console.log(req.accessToken.userId);
    console.log("token")
    console.log(token)
    User.findById(req.accessToken.userId, function (err, user) {
      user.fireBaseToken = token;
      user.save()
      callback(null, "");
    })
    // TODO
  };

  User.login = function (credentials, include, fn) {
    var self = this;
    if (typeof include === 'function') {
      fn = include;
      include = undefined;
    }

    fn = fn || utils.createPromiseCallback();

    include = (include || '');
    if (Array.isArray(include)) {
      include = include.map(function (val) {
        return val.toLowerCase();
      });
    } else {
      include = include.toLowerCase();
    }


    var query = {
      phoneNumber: credentials.phoneNumber
    }

    if (!query.phoneNumber) {
      var err2 = new Error(g.f('{{phoneNumber}} is required'));
      err2.statusCode = 400;
      err2.code = 'PHONENUMBER_REQUIRED';
      fn(err2);
      return fn.promise;
    }

    self.findOne({
      where: query
    }, function (err, user) {
      console.log(query, err, user);
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
        user.hasPassword(credentials.password, function (err, isMatch) {
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



  User.afterRemote('*.__link__roles', function (context, role, next) {
    var user = context.instance;
    user.privilegeIds = _.union(user.privilegeIds, role.privilegeIds);
    user.save(next)
  });

  User.afterRemote('*.__unlink__roles', function (context, undefined, next) {
    var user = context.instance;
    var roleId = context.req.params.fk;
    User.app.models.role.findById(roleId, (err, role) => {
      _.pullAll(user.privilegeIds, role.privilegeIds);
      user.save(next)
    });
  });


  /**
   *
   * @param {string} title
   * @param {string} message
   * @param {array} userIds
   * @param {Function(Error, number)} callback
   */

  User.sendCustomNotification = function (title, message, userIds, callback) {
    var code = 200;
    var where = {};
    if (userIds == undefined || userIds.length == 0)
      where = {
        "status": "activated"
      }
    else
      where = {
        "status": "activated",
        "id": {
          "inq": userIds
        }
      }
    User.find({
      "where": where
    }, function (err, data) {
      if (err)
        return callback(err)
      var arrayOfTokens = []
      data.forEach(element => {
        if (element.fireBaseToken != "" && element.fireBaseToken != null)
          arrayOfTokens.push(element.fireBaseToken)
      });
      console.log("arrayOfTokens");
      console.log(arrayOfTokens);
      console.log("title");
      console.log(title);
      console.log("message");
      console.log(message);

      notifications.sendMultiNot(title, message, arrayOfTokens)
    })
    return callback(null, code)
  };


  User.staffLogin = function (email, password, fn) {
    var self = this;

    var query = {
      email: email
    }

    if (!query.email) {
      var err2 = new Error(g.f('{{email}} is required'));
      err2.statusCode = 400;
      err2.code = 'EMAIL_REQUIRED';
      return fn(err)
    }

    self.findOne({
      where: query
    }, function (err, user) {
      var defaultError = new Error(g.f('login failed'));
      defaultError.statusCode = 401;
      defaultError.code = 'LOGIN_FAILED';

      function tokenHandler(err, token) {
        if (err)
          return fn(err);
        var response = {
          ttl: token.ttl,
          userId: token.userId,
          created: token.created,
          id: token.id,
          user: user
        };

        fn(err, response);
      }

      if (err) {
        debug('An error is reported from User.findOne: %j', err);
        return fn(defaultError);
      } else if (user) {
        user.hasPassword(password, function (err, isMatch) {
          if (err) {
            debug('An error is reported from User.hasPassword: %j', err);
            return fn(defaultError);
          } else if (isMatch) {

            if (user.createAccessToken.length === 2) {
              user.createAccessToken(undefined, tokenHandler);
            } else {
              user.createAccessToken(undefined, {
                email: email,
                password: password
              }, tokenHandler);
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
    accepts: [{
        arg: 'email',
        type: 'string',
        required: true,
        http: {
          source: 'form'
        }
      },
      {
        arg: 'password',
        type: 'string',
        required: true,
        http: {
          source: 'form'
        }
      },
    ],
    returns: {
      arg: 'body',
      type: 'body',
      root: true
    },
    http: {
      verb: 'post',
      path: '/staffLogin'
    },
  });


  /**
   *
   * @param {Function(Error, boolean)} callback
   */

  User.isActivated = function (req, callback) {
    var result;
    User.findById(req.accessToken.userId, function (err, data) {
      if (err)
        return callback(err, null);
      if (data.status != "activated")
        return callback(err, false);
      else
        return callback(err, true);


    })
    // TODO
  };

};
