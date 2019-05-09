var col = db.getCollection('productAbstract').aggregate([

    {
        $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: 'productAbstractId',
            as: 'products'
        }
    }

]);
var bulks = [];
col.forEach((x) => {

    if (x.products[0]) {
        bulks.push(

            {
                updateOne:
                {
                    "filter": { _id: x._id },
                    "update": {
                        $set:
                        {
                            officialConsumerPrice: x.products[0].marketOfficialPrice,
                            officialMassMarketPrice: x.products[0].wholeSaleMarketPrice
                        }
                    }
                }
            }

        );
    }

}); 