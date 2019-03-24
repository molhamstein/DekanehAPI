
'use strict';
module.exports = async function(app) {
     
  // this will trigger the database structure update, like creating indexes (which is not handled by auto-migrate module
  await app.dataSources.mongoDb.autoupdate();
};