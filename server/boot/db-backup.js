'use strict';
module.exports = async function (app) {


    let fs = require('fs');
    let _ = require('lodash');
    let exec = require('child_process').exec;
    let CronJob = require('cron').CronJob;
    let tar = require('tar');
    let path = require("path");


    let { database, user, password } = app.datasources.mongoDb.settings;


    let dbOptions = {
        user,
        pass: password,
        host: 'localhost',
        port: 27017,
        database,
        autoBackup: true,
        removeOldBackup: true,
        keepLastDaysBackup: 7,
        autoBackupPath: '../mongobackups/' // i.e. /let/database-backup/
    };

    /* return if letiable is empty or not. */
    let empty = function (mixedlet) {
        let undef, key, i, len;
        let emptyValues = [undef, null, false, 0, '', '0'];
        for (i = 0, len = emptyValues.length; i < len; i++) {
            if (mixedlet === emptyValues[i]) {
                return true;
            }
        }
        if (typeof mixedlet === 'object') {
            for (key in mixedlet) {
                return false;
            }
            return true;
        }
        return false;
    };
    // Auto backup script
    let dateToPath = (date) => {
        return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
    }
    let dbAutoBackUp = function () {
        // check for auto backup is enabled or disabled
        if (dbOptions.autoBackup == true) {
            let beforeDate, oldBackupPathZip, oldBackupPath;
            let prefix = 'mongodump-';
            let currentDate = new Date();
            let newBackupDate = dateToPath(currentDate);

            let newBackupPath = path.join(dbOptions.autoBackupPath, prefix + newBackupDate); // New backup path for current backup process
            let newBackupPathZip = newBackupPath + '.tar.gz';

            // check for remove old backup after keeping # of days given in configuration
            if (dbOptions.removeOldBackup == true) {
                beforeDate = _.clone(currentDate);
                beforeDate.setDate(beforeDate.getDate() - dbOptions.keepLastDaysBackup); // Substract number of days to keep backup and remove old backup
                let oldBackupDate = dateToPath(beforeDate);

                oldBackupPath = path.join(dbOptions.autoBackupPath, prefix + oldBackupDate); // New backup path for current backup process
                oldBackupPathZip = oldBackupPath + '.tar.gz';


            }
            let cmd = `mongodump --host  ${dbOptions.host}   --port  ${dbOptions.port}  --db  ${dbOptions.database}  ${dbOptions.user ? `--username ${dbOptions.user}` : ''}   ${dbOptions.pass ? `--password ${dbOptions.pass}` : ''}  --out  ${newBackupPath}`; // Command for mongodb dump process

            exec(cmd, async function (error, stdout, stderr) {
                if (empty(error)) {
                    try {
                        await tar.create(
                            {
                                gzip: true,
                                file: newBackupPathZip,
                                preservePaths: true
                            },
                            [newBackupPath]
                        );

                        exec("rm -rf " + newBackupPath, function (err) { });

                    } catch (ex) {
                        // throw ex;
                    }

                    // check for remove old backup after keeping # of days given in configuration
                    if (dbOptions.removeOldBackup == true) {
                        if (fs.existsSync(oldBackupPathZip)) {
                            exec("rm -rf " + oldBackupPathZip, function (err) { });
                        }
                    }
                } else {
                    //throw error;
                }
            });
        }
    }



    // every midnight 
    let job = new CronJob('0 0 0 * * *', function () {
        dbAutoBackUp();
    }, null, true);

}; 