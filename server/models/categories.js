'use strict';

module.exports = function (Categories) {
//   Categories.validatesInclusionOf('status', {
//     in: ["active, inactive"]
//   });

  Categories.validatesLengthOf('code', {
    min: 3,
    max: 3,
    message: {
      min: 'code must be 3 digit'
    }
  });
};
