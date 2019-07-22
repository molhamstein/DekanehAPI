'use strict';
module.exports = async function (app) {
    let MobileDetect = require('mobile-detect');
    let ConfigModel = app.models.config;
    let config = await ConfigModel.singleton();
    app.use((req, res, next) => {

        let agent = req.headers['user-agent'];
        let md = new MobileDetect(agent);
        if (md.mobile()) {
            let version = req.headers['client-version'];

            let result = ConfigModel.validateClient(config, version);
            console.log(result);
            if (result == ConfigModel.codes.InvalidClient || result == ConfigModel.codes.SystemNotRunning) // system not running or unvalid client version 
                next(ERROR(result, 'UNVALID_CLIENT'));
            else if (result == ConfigModel.codes.WarningClient) {
                req.on('end', () => {
                    if (res.statusCode <= 299) {
                        //@todo 
                        //     res.statusCode = ConfigModel.codes.WarningClient;
                    }
                })
                next();
            }
            else
                next();


        } else {
            next();
        }
    });



}; 