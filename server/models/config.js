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
    function compareVersion(version1, version2) {


        if (version1 == version2) return 0;

        let av1 = version1.split(".").map(x => parseFloat(x));
        let av2 = version2.split(".").map(x => parseFloat(x));

        for (let index in av1) {

            if (av1[index] > av2[index]) return 1;
        }

        return -1;
    }

    const ValidClient = 200;
    const WarningClient = 199;
    const InvalidClient = 400;


    Config.clientValidation = async function (req, version) {


        let result = ValidClient;

        let config = await Config.singleton();
        if (!config)
            return { result };

        if (config.clientCurrentVersion === version) {
            result = ValidClient;
        }
        else if (compareVersion(version, config.clientMinimumVersion) == 1) {
            result = WarningClient;
        } else {
            result = InvalidClient;
        }

        return { result };

    }


};
