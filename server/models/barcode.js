'use strict';

module.exports = function(Barcode) {

    Barcode.validatesPresenceOf('productId');
    Barcode.validatesUniquenessOf('code');

};
