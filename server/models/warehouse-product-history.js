'use strict';

module.exports = function(Warehouseproducthistory) {



    Warehouseproducthistory.validatesInclusionOf('shift', {
        in: [1,2,3]
    });
            
};
