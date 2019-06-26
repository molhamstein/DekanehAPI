'use strict';
module.exports = async function (app) {

    let CronJob = require('cron').CronJob;

    // every midnight 
    let job = new CronJob('0 0 0 1 * *', function () {
        app.models.Level.calssifyUsers();
    }, null, true);

}; 