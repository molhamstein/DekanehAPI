'use strict';

module.exports = function (Config) {


    Config.singleton = async () => {

        return await Config.app.models.config.findOne({});
    }

    const ValidClient = 200;
    const WarningClient = 199;
    const InvalidClient = 400;


    Config.clientValidation = async function (req, version) {


        let result = ValidClient;

        let config = await Config.singleton(); 
        if(!config) 
            return {result}; 
        
        if(config.client != version){
            result = InvalidClient;
        }

        return { result };

    }


};
