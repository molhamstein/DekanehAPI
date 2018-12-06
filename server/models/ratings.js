'use strict';

module.exports = function(Ratings) {
	Ratings.validatesInclusionOf('rate', {in: ['sad', 'normal','happy','proceed']});
};
