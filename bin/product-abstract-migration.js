var MongoClient = require('mongodb').MongoClient;
let connectionString = "mongodb://localhost:27017/";

let dbs = {
  "current": "dekaneh_target",
  "target": "dekaneh_product_abstract_target"
};
let main = async () => {

  console.log("migrating product abstract");
  let connection = await MongoClient.connect(connectionString, { useNewUrlParser: true });
  
  let target = connection.db(dbs.target);
  let admin = connection.db("admin");
  console.log("droping target database");
  await target.dropDatabase();
  console.log("done droping target database");

  console.log("copying database");
  let mongoCommand = { copydb: 1, fromhost: "localhost", fromdb: dbs.current, todb: dbs.target };

  await admin.command(mongoCommand);


  console.log("done copying database");

  // migrating products 
  console.log("migrating products");

  let skip  = (product) => { return false; }; 
  for (let product of await target.collection('products').find({}).toArray()) {
    //create product abstract for each product 

    if(skip(product))
     continue; 
    
    let {nameEn , nameAr , categoryId , subCategoryId , manufacturerId , media , ...rest } = product; 
    let productAbstract =  {nameEn , nameAr , categoryId , subCategoryId , manufacturerId , media }; 
    productAbstract.officialConsumerPrice = 0; 
    productAbstract.officialMassMarketPrice = 0 ;

    target.collection('productAbstract').insertOne(productAbstract);
    

  }
  console.log("done migrating products");




  connection.close();

};

main();