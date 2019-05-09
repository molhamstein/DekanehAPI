var MongoClient = require('mongodb').MongoClient;
let connectionString = "mongodb://localhost:27017/";
let dbs = {
    "current": "dekaneh_product_abstract_target",
};
let main = async () => {

    let startTime = (new Date());
    console.log("migrating product abstract");
    let connection = await MongoClient.connect(connectionString, { useNewUrlParser: true });
    let db = connection.db(dbs.current);

    // migrating products 
    console.log("migrating abstract products");

    let warehouse = await db.collection('warehouse').findOne({});
    for (let productAbstract of await db.collection('productAbstract').find({}).toArray()) {


        let product = await db.collection("products").findOne({ productAbstractId: productAbstract._id });

        if (!product) continue;


        productAbstract.officialConsumerPrice = product.marketOfficialPrice;
        productAbstract.officialMassMarketPrice = product.wholeSaleMarketPrice;

        await db.collection('productAbstract').updateOne({ _id: productAbstract._id }, { $set: productAbstract });


        let warehouseProduct = {

            productAbstractId: productAbstract._id,
            warehouseId: warehouse._id,
            warningThreshold: 0,
            avgSellingPrice: 0,
            accumulatedSellingCountOverTime: 0,
            avgBuyingPrice: 0,
            accumulatedBuyingCountOverTime: 0,
            threshold: 0,
            status: "available",
            expectedCount: 0,
            totalCount: 0
        }

        try{
        await db.collection('warehouseProducts').insertOne(warehouseProduct); 
        }catch(e){
            
        }


    }


    console.log("done migrating product abstract");

    connection.close();

    let endTime = new Date();
    let diff = endTime - startTime;
    console.log(`Finished in ${diff}ms`);

};

main();