'use strict';
var path = require('path');
var _ = require('lodash');
var async = require('async');
var myConfig = require('../myConfig');
var thumb = require('node-thumbnail').thumb;
var fs = require('fs');
// var sharp = require('sharp');
var sizeOf = require('image-size');
// var thumb = require('node-thumbnail').thumb;
var easyimage = require('easyimage')
var im = require('imagemagick');

module.exports = function (Attachment) {
  Attachment.afterRemote('upload', function (ctx, result, next) {
    if (!result || !result.result || !result.result.files)
      return next();
    var urls = [];
    var r = result.result.files.file

    ctx.result = [];

    async.each(r, function (file, cb) {
      if (file.container == 'images') {
        var dim = sizeOf('./files/images/' + file.name);
        console.log(dim.width, dim.height);
        var parts = file.name.split('.')
        var extension = "jpg";
        // console.log("SSSSSSSSSSSSSSSSSSSSSS");
        // im.convert(['./files/images/' + file.name, '-resize', '25x120', './files/thumb/' + parts[0] + "_thumb" + extension],
        //   function (err, metadata) {
        //     if (err) return cb(err)
        //     console.log('stdout:', metadata);
        //   })
        // im.resize({
        //     "srcPath": './files/images/' + file.name,
        //     "dstPath": './files/thumb/' + parts[0] + "_thumb" + extension,
        //     "width": dim.width / 2
        //   },
        //   function (err, stdout) {
        //     if (err) {
        // 			console.log(err);
        //       return cb(err);
        //     }
        //     ctx.result.push({
        //       url: myConfig.host + '/' + file.container + '/' + file.name,
        //       thumbnail: myConfig.host + '/thumb/' + parts[0] + "_thumb" + extension
        //     });
        //     return cb();
        //   });
        // sharp('./files/images/'+file.name)
        //   .resize({width : dim.width/2,height : dim.height/2 })
        // 	  .background("white")
        //   .flatten()
        //   .jpeg()
        //   .toBuffer()
        //   .then(data => {
        //   	fs.writeFile("./files/thumb/"+file.name.split(".")[0]+"_thumb.jpeg", data, "binary", function(err) {
        //   		if(err)
        //   			return cb(err);
        // 		ctx.result.push({
        // 			url : myConfig.host + '/' + file.container + '/' + file.name,
        // 			thumbnail : myConfig.host + '/thumb/' + file.name.split(".")[0] + '.jpeg'		
        // 		});
        // 		return cb();
        // 	});
        //   });


        easyimage.thumbnail({
          src: './files/images/' + file.name,
          dst: './files/thumb/' + parts[0] + "_thumb." + extension,
          width: dim.width / 2,
          height: dim.height / 2,
        })
          var thumbnailLink = myConfig.host + '/thumb/' + parts[0] + "_thumb." + extension
          ctx.result.push({
            'url': myConfig.host + '/' + file.container + '/' + file.name,
            // 'secondeUrl': myConfig.host + '/main_thumb/' + file.name.substring(0, file.name.lastIndexOf('.')) + "_thumb." + extension,
            'thumbnail': thumbnailLink
          });
          return cb();
        
        // import {
        //   thumbnail
        // } from "easyimage";
        // try {
        //   const thumbnailInfo = await thumbnail({
        //     src: './files/images/' + file.name,
        //     dst: './files/thumb/' + parts[0] + "_thumb" + extension,
        //     width: dim.width / 2,
        //     height: dim.height / 2,
        //   });
        //   ctx.result.push({
        //     'url': myConfig.host + '/' + file.container + '/' + file.name,
        //     // 'secondeUrl': myConfig.host + '/main_thumb/' + file.name.substring(0, file.name.lastIndexOf('.')) + "_thumb." + extension,
        //     'thumbnail': thumbnailLink
        //   });
        //   return cb();
        // } catch (e) {
        //   console.log("Error: ", e);
        // }
        // thumb({
        //   source: './files/images/' + file.name, // could be a filename: dest/path/image.jpg
        //   destination: "./files/thumb",
        //   concurrency: 4,
        //   width: dim.width / 2
        // }, function (files, err, stdout, stderr) {
        //   var parts = file.name.split('.');
        //   // var extension = parts[parts.length - 1];
        //   var thumbnailLink = myConfig.host + '/thumb/' + file.name.substring(0, file.name.lastIndexOf('.')) + "_thumb." + extension
        //   thumb({
        //     source: './files/images/' + file.name, // could be a filename: dest/path/image.jpg
        //     destination: "./files/main_thumb",
        //     concurrency: 4,
        //     width: dim.width
        //   }, function (files, err, stdout, stderr) {
        //     var parts = file.name.split('.');
        //     // var extension = parts[parts.length - 1];
        //     var extension = "jpg";
        //     ctx.result.push({
        //       'url': myConfig.host + '/' + file.container + '/' + file.name,
        //       'secondeUrl': myConfig.host + '/main_thumb/' + file.name.substring(0, file.name.lastIndexOf('.')) + "_thumb." + extension,
        //       'thumbnail': thumbnailLink
        //     });
        //     return cb();

        //   });

        // });

      } else {
        ctx.result.push({
          url: myConfig.host + '/' + file.container + '/' + file.name
        });
        return cb();
      }
    }, next);
  });

  // Attachment.test = function (cb) {
  //   fs.readdir('./files/images', (err, files) => {
  //     files.forEach(file => {
  //       var dim = sizeOf('./files/images/' + file);
  //       console.log(dim.width, dim.height);
  //       Attachment.app.models.products.findOne({
  //         where: {
  //           'media.url': myConfig.host + '/images/' + file
  //         }
  //       }, function (err, product) {
  //         if (!err && product) {
  //           product.media.thumbnail = myConfig.host + '/thumb/' + file.split(".")[0] + '.jpeg';
  //           product.save((err) => {
  //             console.log("ASDSDASDASDASD", err)
  //           });
  //         }
  //         sharp('./files/images/' + file)
  //           .resize({
  //             width: dim.width / 2,
  //             height: dim.height / 2
  //           })
  //           .background("white")
  //           .flatten()
  //           .jpeg()
  //           .toBuffer()
  //           .then(data => {
  //             fs.writeFile("./files/thumb/" + file.split(".")[0] + ".jpeg", data, "binary", function (err) {
  //               console.log(err); // writes out file without error, but it's not a valid image
  //             });
  //           });
  //       });
  //     });
  //   });
  // }
  // Attachment.remoteMethod('test', {
  //   description: 'test',
  //   accepts: [
  //     // {arg: 'limit', type: 'number', 'http': {source: 'query'}}
  //   ],
  //   returns: {
  //     arg: 'body',
  //     type: 'body',
  //     root: true
  //   },
  //   http: {
  //     verb: 'get',
  //     path: '/test'
  //   },
  // });
};
