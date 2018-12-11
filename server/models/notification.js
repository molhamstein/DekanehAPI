'use strict';

module.exports = function (Notification) {


  /**
   *
   * @param {Function(Error, string)} callback
   */

  Notification.makeAllRead = function (callback) {
    var result;
    Notification.updateAll({
      isSeen: true
    }, function (err, info) {
      if (err)
        return callback(err, null)
      callback(null, "done");

    });
    // TODO
  };
};
