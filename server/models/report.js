"use strict";

module.exports = function (Report) {


    Report.afterRemote('create', async function (ctx, result) {
        console.log('test');
       await Report.app.models.notification.create({
            "type": "stock",
            "orderId": result.orderId,
            "object": { reportId: result.id }
        });


        return result;
    });


}