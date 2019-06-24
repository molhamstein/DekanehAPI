'use strict';

module.exports = function (AwardAction) {
    AwardAction.validatesInclusionOf('type', { in: ['price', 'count', 'products-price', 'products-count', 'company-price', 'company-count'] });
};
