'use strict';
var path = require('path');
var _ = require('lodash');
var async = require('async');
var myConfig = require('../myConfig');
var thumb = require('node-thumbnail').thumb;
var fs = require('fs');
var sharp = require('sharp');
var sizeOf = require('image-size');

module.exports = function(Attachment) {
	Attachment.afterRemote('upload', function(ctx,result, next) {
		if(!result || !result.result || !result.result.files )
			return next();
		var urls = [];
		var r = result.result.files.file

		ctx.result = [];

		async.each(r,function(file,cb){
			if(file.container == 'images'){
				var dim = sizeOf('./files/images/'+file.name);
				console.log(dim.width, dim.height);
				sharp('./files/images/'+file.name)
				  .resize({width : dim.width/2,height : dim.height/2 })
				  .toBuffer()
				  .then(data => {
				  	fs.writeFile("./files/thumb/"+file.name.split(".")[0]+"_thumb.jpeg", data, "binary", function(err) {
				  		if(err)
				  			return cb(err);
						ctx.result.push({
							url : myConfig.host + '/' + file.container + '/' + file.name					
						});
						return cb();
					});
				  });
				// thumb({
				//   source :  path.join(__dirname, '../../files/',file.container,file.name),
				//   destination :  path.join(__dirname, '../../files/thumb'), 
				//   width: 240
				// }, function(files, err, stdout, stderr) {
				// 	if(err)
				// 		return cb(err);
				// 	ctx.result.push({
				// 		url : myConfig.host + '/' + file.container + '/' + file.name					
				// 	});
				// 	return cb();
				// });
			}
			else{
				ctx.result.push({
					url : myConfig.host + '/' + file.container + '/' + file.name
				});
				return cb();
			}
		},next);
	});

	Attachment.test = function(cb){
		fs.readdir('./files/images', (err, files) => {
		  files.forEach(file => {
			var dim = sizeOf('./files/images/'+file);
			console.log(dim.width, dim.height);

			sharp('./files/images/'+file)
			  .resize({width : dim.width/2,height : dim.height/2 })
			  .toBuffer()
			  .then(data => {
			  	fs.writeFile("./files/thumb/"+file.split(".")[0]+"_thumb.jpeg", data, "binary", function(err) {
				  console.log(err); // writes out file without error, but it's not a valid image
				});
			  });
		  });
		});
	}
	Attachment.remoteMethod('test', {
    	description: 'test',
		accepts: [
			// {arg: 'limit', type: 'number', 'http': {source: 'query'}}
		],
		returns: {arg: 'body', type: 'body',root: true},
		http: {verb: 'get',path: '/test'},
    });
};
