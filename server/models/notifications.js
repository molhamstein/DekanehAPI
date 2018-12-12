'use strict';

module.exports = function(Notifications) {
	Notifications.validatesInclusionOf('action', {in: ['orderDelivered']});
};