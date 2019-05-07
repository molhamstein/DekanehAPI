'use strict';
module.exports = async function (app) {


    let fs = require('fs');
    let _ = require('lodash');
    let exec = require('child_process').exec;
    let CronJob = require('cron').CronJob;
    let tar = require('tar');
    let path = require("path");

    let options = {

        sourcePath: "files/images/",
        backupPath: "../images-backup/"

    };

    async function imagesBackup() {

        console.log("images backup");
        let images = await fs.promises.readdir(options.sourcePath);

        for (let image of images) {

            let imageSourcePath = path.join(options.sourcePath, image);
            let imageBackupPath = path.join(options.backupPath, image);

            if (!fs.existsSync(imageBackupPath)) {
                fs.copyFile(imageSourcePath, imageBackupPath, (err) => { });
            }
        }


    }

    // every midnight 
    let job = new CronJob('0 0 0 * * *', function () {
        imagesBackup();
    }, null, true);

}; 