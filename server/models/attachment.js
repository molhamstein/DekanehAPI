'use strict';
var path = require('path');
var _ = require('lodash');
var async = require('async');
var myConfig = require('../myConfig');
var thumb = require('node-thumbnail').thumb;

module.exports = function(Attachment) {
	Attachment.afterRemote('upload', function(ctx,result, next) {
		if(!result || !result.result || !result.result.files )
			return next();
		var urls = [];
		var r = result.result.files.file

		ctx.result = [];

		async.each(r,function(file,cb){
			if(file.container == 'images'){
				thumb({
				  source :  path.join(__dirname, '../../files/',file.container,file.name),
				  destination :  path.join(__dirname, '../../files/thumb'), 
				  width: 240
				}, function(files, err, stdout, stderr) {
					if(err)
						return cb(err);
					ctx.result.push({
						url : myConfig.host + '/' + file.container + '/' + file.name					
					});
					return cb();
				});
			}
			else{
				ctx.result.push({
					url : myConfig.host + '/' + file.container + '/' + file.name
				});
				return cb();
			}
		},next);
		
	});
};
