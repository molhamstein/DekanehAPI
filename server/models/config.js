'use strict';

module.exports = function (Config) {


    Config.singleton = async () => {

        return await Config.app.models.config.findOne({});
    }
    /**
     * 
     * @param String version1 
     * @param String version2 
     * Compare version1 to version2 
     * @return @number
     * @returns 0 if version1 == version2 
     * @returns 1 if version1 > version2 
     * @returns -1 if version1 < version2 
     */
    Config.compareVersion = (version1, version2) => {


        if (version1 == version2) return 0;

        let av1 = version1.split(".").map(x => parseFloat(x));
        let av2 = version2.split(".").map(x => parseFloat(x));
        
        for (let index in av1) {
            if (av1[index] != av2[index])
                return av1[index] > av2[index] ? 1 : -1;
        }

        return 0;
    }

    Config.codes = {
        ValidClient: 200,
        WarningClient: 199,
        InvalidClient: 666,
        SystemNotRunning: 667
    }
    Config.validateClient = function (config, version) {

        let result = Config.codes.ValidClient;

        if (!config)
            return result; 

        if(!config.running)
            return Config.codes.SystemNotRunning; 

        if (config.clientCurrentVersion === version) {
            result = Config.codes.ValidClient;;
        }
        else if (Config.compareVersion(version, config.clientMinimumVersion) >= 0) {
            result = Config.codes.WarningClient;
        } else {
            result = Config.codes.InvalidClient;
        }

        return result;

    }

    Config.clientValidation = async function (req, version) {


        let config = await Config.singleton();
        let result = Config.validateClient(config, version);
        return { result };

    }
    Config.setRunning = async function (req,  value){
        let config = await Config.singleton(); 
        config.running = value; 
        await config.save(); 
        return config ; 
    }


};
