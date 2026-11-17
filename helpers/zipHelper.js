var express = require('express');
const path = require('path');

const fs = require('fs');
const app = express();

const uuidv1 = require('uuid/v1');
 
 var AdmZip = require('adm-zip');

var zip = new require('node-zip')();


const rawFilesLocation = path.dirname(__dirname) + '/uploads/raw/';

exports.getFileNamesInZip = function(fileUrl) {
  var zip = new AdmZip(fileUrl);
  
  var zipEntries = zip.getEntries().map(function(entry) {
  	return entry.entryName;
  });

  return zipEntries;
}

exports.unzip = function(fileUrl){
  var zip = new AdmZip(fileUrl);
  var unsafeEntry = zip.getEntries().find(function(entry) {
    var entryName = entry.entryName.replace(/\\/g, '/');
    var normalizedName = path.posix.normalize(entryName);

    return path.posix.isAbsolute(entryName) ||
      /^[A-Za-z]:\//.test(entryName) ||
      normalizedName === '..' ||
      normalizedName.indexOf('../') === 0;
  });
  if (unsafeEntry) {
    throw new Error('Archive contains an unsafe file path: ' + unsafeEntry.entryName);
  }

  var rand = uuidv1();
  //console.log(rand);
  var folder = rawFilesLocation + path.basename(fileUrl) + '-' + rand + '/';
  //console.log(folder);
  
	zip.extractAllTo(folder, true);

	return folder;
}

// get all filse within folder (for testing only)
exports.get_files = function(folder) {
  let filenames = [];

  fs.readdirSync(folder).forEach(file => {
    filenames.push(path.resolve(folder, file));
  });

  return filenames;
}

//get all files recursively
exports.getAllFiles = function getAllFiles(dirPath) {
  const arrayOfFiles = [];
  const files = fs.readdirSync(dirPath);
  files.forEach(function(file) {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles.push(...getAllFiles(filePath));
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}


exports.zip = function(fileUrls,name){
  /*var zip = new require('node-zip')();

  for(var file of fileUrls){
    var fn = path.basename(file);
    zip.file(fn,fs.readFileSync(file));
  }
  var data = zip.generate({base64:true,compression:'DEFLATE'});

  //return data;
  
  var rand = uuidv1();
  var zipFileUrl = 'downloads/researchData'+ rand + '.zip';
  fs.writeFileSync(zipFileUrl, data, 'binary');
  return zipFileUrl;*/

  //creating archives
  var zip = new AdmZip();
  var rand = uuidv1();

  for(var file of fileUrls){
    // add local file
    try{
      if (fs.existsSync(file)) {
        //file exists
        zip.addLocalFile(file); 
      }
    } catch(err) {
      console.error(err)
    }     
  }
  //
  // var willSendthis = zip.toBuffer();
  // return willSendthis;
  // or write everything to disk
  var archiveName = name || 'ResearchData';
  var zipFileUrl = 'downloads/' + archiveName + '-' + rand + '.zip';
  zip.writeZip(zipFileUrl);
  return zipFileUrl;
}
