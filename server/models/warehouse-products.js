'use strict';

module.exports = function (Warehouseproducts) {

    Warehouseproducts.validatesInclusionOf('status', {
        in: ['available', 'unavailable', 'pending']
    });

    Warehouseproducts.prototype.updateExpectedCount = function (expectedCountDiff) {

        this.expectedCount = this.expectedCount + expectedCountDiff;
        return this.save();
    }
    Warehouseproducts.prototype.updateEffictiveCount = function (effictiveCountDiff) {
        this.effictiveCount = this.effictiveCount + effictiveCountDiff;
        return this.save();
    }


   


};


