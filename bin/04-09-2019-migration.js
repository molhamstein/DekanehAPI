



var MongoClient = require('mongodb').MongoClient;

let connectionString = "mongodb://localhost:27017/";

let dbs = {
  "dev": "dekaneh1",
  "live": "dekaneh_backup",
  "target": "dekaneh_target"
};
let main = async () => {

  // this will trigger the database structure update, like creating indexes (which is not handled by auto-migrate module
  //await app.dataSources.mongoDb.autoupdate();

  console.log("migrating");

  let connection = await MongoClient.connect(connectionString, { useNewUrlParser: true });
  // let live = connection.db(dbs.live); 
  //let dev = connection.db(dbs.dev); 
  let target = connection.db(dbs.target);
  let admin = connection.db("admin");
  console.log("droping target database");
  await target.dropDatabase();
  console.log("done droping target database");

  console.log("copying database");
  let mongoCommand = { copydb: 1, fromhost: "localhost", fromdb: dbs.live, todb: dbs.target };

  await admin.command(mongoCommand);


  console.log("done copying database");

  // migrating products 
  console.log("migrating products");
  for (let product of await target.collection('products').find({}).toArray()) {
    let targetProduct = product;

    // deleted props 
    delete targetProduct.wholeSaleMarketPrice;
    delete targetProduct.marketOfficialPrice;
    delete targetProduct.dockanBuyingPrice;

    // new props 
    targetProduct.parentCount = 0;
    targetProduct.productAbstract = null;
    target.collection('products').replaceOne({ _id: targetProduct._id }, targetProduct);
  }
  console.log("done migrating products");

  // migrating orderProducts 
  console.log("migrating orderProducts");
  for (let orderProduct of await target.collection('orderProducts').find({}).toArray()) {



    let snapshotProps = ["nameAr", "nameEn", "warehouseAvgBuyingPrice"
      , "officialMassMarketPrice", "horecaPrice", "horecaPriceDiscount",
      "wholeSalePrice", "wholeSalePriceDiscount", "pack", "description", "offerSource",
      "isOffer", "media"];

    let snapshot = {}; 

    snapshotProps.forEach( (prop) => {
      snapshot[prop]  = orderProduct[prop]; 
      delete orderProduct[prop]; 
    }); 

    orderProduct.sellingPrice = orderProduct.price ;
    // deleted props 
    delete orderProduct.wholeSaleMarketPrice;
    delete orderProduct.marketOfficialPrice;
    delete orderProduct.dockanBuyingPrice;
    delete orderProduct.price ; 


    orderProduct.productSnapshot = snapshot;


    target.collection('orderProducts').replaceOne({ _id: orderProduct._id }, orderProduct);


  }
  console.log("done migrating orderProducts");



  console.log("migrating suppliers");
  await target.collection('suppliers').drop();
  console.log("done migrating suppliers");

  console.log("migrating orders from suppliers");
  await target.collection('ordersFromSuppliers').drop();
  console.log("done orders from suppliers");




  connection.close();

};

main();