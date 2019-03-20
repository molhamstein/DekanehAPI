var path = require('path');
var app = require('../server/server');
var ds = app.datasources.mongoDb;
ds.automigrate('warehouseProducts', function(err) {
    console.log(err); 
  if (err) throw err;

        ds.disconnect();
  
});