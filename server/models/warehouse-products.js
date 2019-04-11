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
        let warning =  collection.count({ and : [ {$expr: { lte: [ "$expectedCount" , "$warningThreshold" ] }} , { $expr : { gt: [ "$expectedCount" , "$threshold" ] }  } ] });
        let total =  collection.count({}); 
        let stockOut =    collection.count({$expr: { lte: [ "$expectedCount" , "$threshold" ] }}); 
        [warning , total , stockOut] = await Promise.all([warning , total , stockOut]); 
        
        return {total , warning , stockOut}; 
    }




};


