'use strict';
var _ = require('lodash');
var myConfig = require('../myConfig');
module.exports = function(Attachment) {
	Attachment.afterRemote('upload', function(ctx,result, next) {
		if(!result || !result.result || !result.result.files )
			return next();
		var urls = [];
		var r = result.result.files.file
		_.each(r,function(file){
			var object = {
				url : myConfig.host + '/' + file.container + '/' + file.name,
			}
			urls.push(object)
		});
		ctx.result = urls;
		return next();

		
	});
};
