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
    //Statistics about warehouse products state 
    Warehouseproducts.statistics = async function(req){

        let collection =  Warehouseproducts.app.models.warehouseProducts;        
        let warning = await collection.count({ and : [ {$expr: { lte: [ "$expectedCount" , "$warningThreshold" ] }} , { $expr : { gt: [ "$expectedCount" , "$threshold" ] }  } ] });
        let total = await collection.count({}); 
        let stockOut =   await collection.count({$expr: { lte: [ "$expectedCount" , "$threshold" ] }}); 

        return {total , warning , stockOut}; 
    }




};


