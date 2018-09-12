'use strict';

module.exports = function(Topslider) {
	Topslider.validatesInclusionOf('status', {in: [ 'activated','deactivated']});
	Topslider.validatesInclusionOf('type', {in: [ 'product','external']});

};
