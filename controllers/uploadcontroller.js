var express = require('express');
const app = express();
//const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
var mongoose = require('mongoose');
const _ = require('lodash');
const escapeHtml = require('escape-html');

var uploadHelper = require('../helpers/uploadHelper');
var verifyHelper = require('../helpers/dataVerificationModified');
var zipHelper = require('../helpers/zipHelper');
var sendEmail = require('../helpers/sendEmail');
var doi = require('../helpers/doi');

const Metric = require('../models/Metric');

var SubmissionModel = require('../models/SubmissionModel');
var SubmissionInfoModel = require('../models/SubmissionInfoModel');
var MetaDataFileModel = require('../models/MetaDataFileModel');
var MetaDataInformationModel = require('../models/MetaDataInformationModel');
var RawFileModel = require('../models/RawFileModel');
var ReadMeFileModel = require('../models/ReadMeFileModel');

exports.startUpload = function(req, res) {
  res.render('uploadData/startUpload', {error: null, user: req.user });
};

exports.getUpload = function(req, res) {
  let filenames = {};

  res.render('uploadData/upload', {filelist: filenames, moment: moment, error: null, user: req.user});
};

var userEmail = "";
var name = "";
var setEmbargo = false;
exports.postUpload = function(req, res, next) {
  var report = [];
  userEmail = req.body.email;
  setEmbargo = req.body.dataEmbargo;
  name = req.body.fname + " " + req.body.lname;
  // verify request parameters 
  err = {};
  if(!verifyHelper.verifyUploadRequest(req,err)){
    res.status(403).send("No files were uploaded! Error Occured: VUR " + err.details);
    return;
  }

  // set submissionInfo object from request paramters
  var subInfo = extractSubmissionInfoFromReqBody(req.body);
  

  // create all needed objects for the upload process
  let uploadSet = createUploadObjectsSet(subInfo);
  //set userId to this submission
  uploadSet.submissionInfo.userId= req.user._id;
  // upload meta file to server
  // TODO: metafile path not present in schema? extract and delete?
  uploadSet.metaFile.path = uploadHelper.uploadFileToServer(req.files.metaFile, function(err) {
    if (err){
      console.log("Error with meta file upload!"); 
      
      res.status(403).send("No files were uploaded! Error Occured: meta " + err.details);
      return;
    }
    uploadSet.submission.metaFilePath = uploadSet.metaFile.path;
    // Do meta file header validations here
    var metaFieldsError = {};
    if (!verifyHelper.verifyMetaFileHeaderFields(uploadSet.metaFile.path,metaFieldsError)){
      console.log("Error with meta file header!"); 
      report.push(metaFieldsError.details);
      //res.status(403).send("No files were uploaded! Error Occured: " + metaFieldsError.details);
      //return;
    }

    // Validate that all meta file rows contain All required values
    // verify that all required fields for this template exist in every row
    var metaDataRowsError = {};
    uploadSet.metaDetaInformations = verifyHelper.verifyAndGetMetaDataRows(uploadSet.metaFile.path,metaDataRowsError);

    if(!uploadSet.metaDetaInformations){
      console.log("Error with meta files raw file value !"); 
      report.push(metaDataRowsError.details);
      //res.status(403).send("No files were uploaded! Error Occured: " + metaDataRowsError.details);
      //return;
    }

    // upload raw file to server 
    uploadSet.rawFile.path = uploadHelper.uploadFileToServer(req.files.rawFile,function(err) {
      if (err){
        console.log("Error with raw file upload!"); 
        res.status(403).send("No files were uploaded! Error Occured: raw" + err.details);
        return;
      }
      
      // validate that raw files in zip file and the meta file rows match, 
      // use this function to get list of raw files in zip:
      var rawFolderPath = zipHelper.unzip(uploadSet.rawFile.path);
      
      uploadSet.submission.rawFilePath = uploadSet.rawFile.path;
      //console.log("file path:" + rawFolderPath);

      ///Extract raw file from zip
      //var rawFilesInZip = zipHelper.get_files(rawFolderPath);
      var rawFilesInZip = zipHelper.getAllFiles(rawFolderPath);

      // extract all raw files from zip
      rawFilesInZip.forEach(function(zipEntry) {
        //console.log("all files" + zipEntry);
      }); 

      if(rawFilesInZip.length!= uploadSet.metaDetaInformations.length){
      var number= "Number of Raw Files does not match number of rows in meta file!";
        report.push(number);
      }

      ///match metadata filename column with raw files name
      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      var metaDetaInformations = verifyHelper.getMetaDataRows(uploadSet.metaFile.path,metaDataRowsError);
      missingMetaInfo = [];
      for (const rawFilex of rawFilesInZip) {
        var rawFileNamex = path.basename(rawFilex);
        // get meta row from meta file corresponding to this file
        var metaDatax = metaDetaInformations.find(obj => {
          return rawFileNamex.includes(obj.filename.trim());
        });
        if(metaDatax == undefined || metaDatax==null){
          missingMetaInfo.push(rawFileNamex + " ");
        }
      }
      errorRaw="";
      if(missingMetaInfo.length > 0){
        errorRaw=("Raw File Error, No metadata found in metadata file for raw files:  " + missingMetaInfo.join());
        report.push(errorRaw);
      }
      if (report.length >0){
         sendErrorMassage="No files were uploaded to the repository! Error Occured. We have sent a detailed report to your email. "
         res.render('uploadData/upload', { moment: moment, error: sendErrorMassage, user: req.user, uploadInfo: null });
        //res.status(403).send("No files were uploaded to the repository! Error Occured. We will send a detailed report to you soon. ");
        // Error report info file location
        var errorReportFileLocation = rawFolderPath + 'Error_Report' + '.txt';
          
        // generate submission info file content (json to csv)
        var errorReportFileContent = report.map(f => f + '\n\n') + '\n'; 
        fs.writeFileSync(errorReportFileLocation, "Following issues have been found in your submission: \n\n\n");
        fs.appendFileSync(errorReportFileLocation, errorReportFileContent);
        
        var emailBody = sendEmail.generateErrorReport(name, report);
        // Send Email detailing metrics calculations results
        sendEmail.sendErrorEmail(userEmail,emailBody,errorReportFileLocation);

        return;
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // Map raw files to meta rows and create a MetadataInformation and a raw file object for each mapping 
      for (const rawFile of rawFilesInZip) {
        //console.log(rawFile);
        var rawFileName = path.basename(rawFile);
        
        // get meta row from met file corresponding to this file
        var metaData = uploadSet.metaDetaInformations.find(obj => {
          //console.log(obj.filename);
          return rawFileName.includes(obj.filename.trim());
        });

        // create raw file object
        var rawF = {};
        rawF._id = mongoose.Types.ObjectId();
        rawF.submissionId = uploadSet.submission._id;
        rawF.name = metaData.filename;
        // rawF.name = rawFileName;
        // TODO: confirm with client that this is the meaning of type here
        rawF.type =  uploadSet.submissionInfo.typeOfData;
        rawF.path = rawFile;
        uploadSet.rawFiles.push(rawF);

        // set metadataobject rawFileId to created rawFileID
        metaData.submissionId= uploadSet.submission._id;
        metaData.rawFileId = rawF._id; 
        metaData.metaDataFileId = uploadSet.metaFile._id; 
      }
          //upload README file to server
      if(req.files.readMeFile){
          uploadSet.readMeFile.path = uploadHelper.uploadFileToServer(req.files.readMeFile, function(err) {
            if (err){
              console.log("Error with ReadMe file upload! No readme file were uploaded"); 
              // res.status(403).send("No files were uploaded! Er0ror Occured: meta " + err.details);
              // return;
            }
          // generating DOI for data set
          doi.addDoi(uploadSet.submissionInfo, function(resp){
            var getDoi= JSON.parse(resp)
            //console.log(resp);
            console.log("DOI"+getDoi.data.id);
            uploadSet.submissionInfo.doi = getDoi.data.id;
            console.log("DOI2"+uploadSet.submissionInfo.doi);
          
            // Save complete dataset to DB
            if (saveUploadObjectsToDB(uploadSet)){
            //res.send("Data Uploaded Successfully! Metrics calculation is on proccess. Confirmation Email will be sent soon!");
            let filenames = {};
            // TODO: Calculate metrics

            var metricsResultsList = calculateMetrics(uploadSet, rawFolderPath, userEmail, name);
            res.render('uploadData/upload', {filelist: filenames, moment: moment, error: null, user: req.user, uploadInfo: uploadSet.submissionInfo });       
            }
            else{
              res.status(403).send("No files were uploaded! Error Occured: meta ");
      
            }

          });
    
          return;
        
        });
      }
      else{
        //adding empty string to path
        uploadSet.readMeFile.path = "";
        doi.addDoi(uploadSet.submissionInfo, function(resp){
          var getDoi= JSON.parse(resp)
          //console.log(resp);
          console.log("DOI"+getDoi.data.id);
          uploadSet.submissionInfo.doi = getDoi.data.id;
          console.log("DOI2"+uploadSet.submissionInfo.doi);
        
          // Save complete dataset to DB
          if (saveUploadObjectsToDB(uploadSet)){
          //res.send("Data Uploaded Successfully! Metrics calculation is on proccess. Confirmation Email will be sent soon!");
          let filenames = {};
          // TODO: Calculate metrics

          var metricsResultsList = calculateMetrics(uploadSet, rawFolderPath, userEmail, name);
          res.render('uploadData/upload', { moment: moment, error: null, user: req.user, uploadInfo: uploadSet.submissionInfo });       
          }
          else{
            //res.render('uploadData/upload', {filelist: filenames, moment: moment, error: null, user: req.user, uploadInfo: uploadSet.submissionInfo });
            res.status(403).send("No files were uploaded! Error Occured!! ");
    
          }

        });
  
        return;


      }
  
    });  

 });
};


async function calculateMetrics(uploadSet, rawFolderPath, userEmail, name){

    let result = await Metric.fromRawFile(uploadSet,rawFolderPath);
    //console.log(result);
    result.metrics.map(m => m.save());
    //if (err){
      //console.log("submission save ERROR! " + err);
      //return false;
   // }
   // generate email body
   var emailBody = sendEmail.generateUploadReport(name, result, uploadSet);

   // Send Email detailing metrics calculations results
   sendEmail.sendSuccessEmail(userEmail,emailBody,rawFolderPath);

   // TODO: Release raw files that passed the metrics calculations
    return result;

}





function createUploadObjectsSet(subInfo) {
  let uploadSet = {};
  // create submission object and set all ids 
  uploadSet.submission = {};
  uploadSet.submission._id = mongoose.Types.ObjectId();

  uploadSet.metaFile = {};
  uploadSet.metaFile._id = mongoose.Types.ObjectId();
  uploadSet.metaFile.submissionId =uploadSet.submission._id;

  uploadSet.metaDetaInformations = [];
  

  uploadSet.rawFile = {};
  uploadSet.rawFile._id = mongoose.Types.ObjectId();
  uploadSet.rawFile.submissionId =uploadSet.submission._id;


  uploadSet.readMeFile = {};
  uploadSet.readMeFile._id = mongoose.Types.ObjectId();
  uploadSet.readMeFile.submissionId =uploadSet.submission._id;

  uploadSet.rawFiles = [];

  uploadSet.submissionInfo = subInfo;
  uploadSet.submissionInfo._id = mongoose.Types.ObjectId();
  uploadSet.submissionInfo.submissionId =uploadSet.submission._id;

  // set all ids into submission  
  uploadSet.submission.submissionInfoId = uploadSet.submissionInfo._id;
  uploadSet.submission.rawFileId = uploadSet.rawFile._id;
  uploadSet.submission.metaDataFileId = uploadSet.metaFile._id;
  uploadSet.submission.readMeFileId = uploadSet.readMeFile._id;
  

  return uploadSet;
}

function saveUploadObjectsToDB(uploadSet) {
  //console.log(uploadSet);
  SubmissionModel.create(uploadSet.submission, function (err, submission_instance) {
    if (err){
      console.log("submission save ERROR! " + err);
      return false;
    }
  });

  SubmissionInfoModel.create(uploadSet.submissionInfo, function (err, submissionInfo_instance) {
    if (err){
      console.log("submissionInfo save ERROR! " + err);
      return false;
    }
  });

  MetaDataFileModel.create(uploadSet.metaFile, function (err, metaFile_instance) {
    if (err) {
      console.log("metaFile save ERROR! " + err);
      return false;
    }
  });

  ReadMeFileModel.create(uploadSet.readMeFile, function (err, metaFile_instance) {
    if (err) {
      console.log("reamMeFile save ERROR! " + err);
      return false;
    }
  });

  for (var i = uploadSet.rawFiles.length - 1; i >= 0; i--) {
    rawF = uploadSet.rawFiles[i];
    RawFileModel.create(rawF, function (err, rawFile_instance) {
      if (err){
        console.log("rawFile save ERROR! " + err);
        return false;
      }
    });
  }

  for (var i = uploadSet.metaDetaInformations.length - 1; i >= 0; i--) {
    metaDataRow = uploadSet.metaDetaInformations[i];
    MetaDataInformationModel.create(metaDataRow, function (err, metaDataInformation_instance) {
      if (err){
        console.log("metaDataRow save ERROR! " + err);
        return false;
      }
    });
  }

  return true;
}

// TODO: move to helper?
function extractSubmissionInfoFromReqBody(requestBody){
  let submissionInfo = {};

  // TODO: Extract All parameters 
  submissionInfo.name = requestBody.fname + " " + requestBody.lname;
  submissionInfo.email = requestBody.email;
  submissionInfo.institute = requestBody.institute;

  submissionInfo.typeOfData = requestBody.dataType;
  //submissionInfo.dataFrom = requestBody.dataFrom;
  submissionInfo.published = requestBody.dataPublished;
  submissionInfo.reference = requestBody.reference;
  submissionInfo.doi = requestBody.doi;
  submissionInfo.embargo = requestBody.dataEmbargo;
  submissionInfo.releaseDate = requestBody.embargoDate;

  return submissionInfo; 
}




