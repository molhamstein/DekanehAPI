'use strict';

module.exports = function (Warehouseproducts) {

    Warehouseproducts.validatesInclusionOf('status', {
        in: ['available', 'unavailable', 'pending']
    });

    Warehouseproducts.prototype.updateExpectedCount = function (expectedCountDiff) {
        this.expectedCount = this.expectedCount + expectedCountDiff;        
        return this.save();
    }
    Warehouseproducts.prototype.updatetotalCount = function (totalCountDiff) {
        this.totalCount = this.totalCount + totalCountDiff;
        return this.save();
    }


   


};


