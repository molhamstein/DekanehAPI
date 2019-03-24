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


    Warehouseproducts.beforeRemote('create', (ctx, modelInstance, next) => {

        // @todo unique index of { warehouseId, productAbstractId }
        // validate uniqueness of Warehouse Product         
        let { warehouseId, productAbstractId } = ctx.req.body;
        Warehouseproducts.findOne({ where: { warehouseId, productAbstractId } }, (err, warehouseProduct) => {
            if (err || warehouseProduct) {
                next(ERROR(422, "Warehouse Product Already Exist"));
            } else {
                next();
            }
        });
    });


};


