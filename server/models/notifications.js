'use strict';

module.exports = function(Usernotifications) {
	Usernotifications.validatesInclusionOf('action', {in: ['orderDelivered' , 'orderInDelivery' , 'rewardUser']});
};