'use strict';

module.exports = function(AwardAction) {
    AwardAction.validatesInclusionOf('type', { in: ['price', 'count' ]});
};
