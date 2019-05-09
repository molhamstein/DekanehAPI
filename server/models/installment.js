'use strict';

module.exports = function (Installment) {

    Installment.validatesPresenceOf("userId");

    Installment.afterRemote('create', async function (ctx, installment) {
        let user = await installment.user.getAsync(); 
        user.balance += installment.amount; 
        await user.save(); 
        return installment; 

    });
    Installment.editInstallment = async function (id, amount) {

        let installment = await Installment.app.models.installment.findById(id);
        if (!installment)
            throw ERROR(404, "Installment Not found");

        let user = await installment.user.getAsync(); 

        user.balance -= installment.amount; 
        user.balance += amount ; 
        installment.amount = amount ; 

        await installment.save(); 
        await user.save(); 

        return installment; 
    }
};
