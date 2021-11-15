var express = require('express');
const app = express();

const fs = require('fs');
const path = require('path');
const moment = require('moment');
var mongoose = require('mongoose');

const uuidv1 = require('uuid/v1');
var zipHelper = require('../helpers/zipHelper');

const { Parser } = require('json2csv');

var SubmissionModel = require('../models/SubmissionModel');
var SubmissionInfoModel = require('../models/SubmissionInfoModel');
var MetaDataFileModel = require('../models/MetaDataFileModel');
var MetaDataInformationModel = require('../models/MetaDataInformationModel');
var RawFileModel = require('../models/RawFileModel');
var SearchResultModel = require('../models/SearchResultModel');
var SearchTermModel = require('../models/SearchTermModel');
var MetricsModel = require('../models/Metric');
var ReadMeFileModel = require('../models/ReadMeFileModel');


// get search by submission page
exports.getSearchSub = function(req, res) {

    res.render('searchBySubmission/searchSubmission', {searchResult: null, error: null, user: req.user, input: null});    

};

// get search result 
exports.postSearchSub = function(req, res, next) {
  //console.log(req.body.sex);
  extractSearchQueryFromReq(req.body).then(function (query) {
    var columns = 'name institue submissionId typeOfData doi';
    //console.log(query);
    SubmissionInfoModel.find(query, columns, async function(err, subDatas){
      if(err){
        console.log("Error retrieving meta data information from DB: " + err);
      } else {
        var searchResultIns = {};
        searchResultIns._id = mongoose.Types.ObjectId();
  
        var results = [];
        var resultsSigList = [];
        var ids = [];
        var resultSubdatas =[];
        for (var subRow of subDatas)
        {
          resultSubdatas.push(getSearchRowSignature(subRow));
        }


        for(var subData of subDatas){
          // push id into ids list 
          console.log(subData.doi);
          ids.push(subData._id);
          
          var sig = getSearchRowSignature(subData);
          var count = resultSubdatas.filter(x => x === sig).length;
          if(resultsSigList.indexOf(sig) === -1){
            // create result object and fill metadata info
            var result = {};
            result.SearchResultId = searchResultIns._id;
            result.TotalSearchResultCount = subDatas.length;
            result._id = subData._id;
            result.submissionId = subData.submissionId;
            result.name = subData.name;
            //result.dataFrom = subData.dataFrom;
            result.typeOfData = subData.typeOfData;
            result.doi = subData.doi;
            result.institute = subData.institute;
            result.count = count;
            //var rFile = await RawFileModel.findById(metaData.rawFileId);
            //result.url = path.resolve(path.normalize(rFile.path));
  
            results.push(result);
            resultsSigList.push(sig);
          }      
        }
  
        //save ids in search result
        searchResultIns.MetaDataInformationIds = ids;
  
        // save search result
        SearchResultModel.create(searchResultIns, function (err, searchResult_instance) {
          if (err){
            console.log("SearchResult save ERROR! " + err);
            return false;
          }
        });
        var ret = JSON.stringify(results);
        res.render('searchBySubmission/searchSubmission.ejs', {searchResult: results, error: null, user: req.user});
      }
    });    
  });
};

function getSearchRowSignature(row) {
  if(row!=undefined && row != ""){
    return row.name+ row.institute + row.submissionId + row.typeOfData+ row.doi;
  }
}
//////////////////////////////////// DOWNLOAD////////////////////////////////////////
// download search result
exports.downloadSearchResult = function(req, res, next) {
  
  SearchResultModel.findOne({ _id: req.body.SearchResultId }, async function(err, searchResult){
    if(err){
      console.log("Error retrieving search result from DB: " + err);
    } else{
    //console.log(req.body);
      var rand = uuidv1();

      //var metaDataIdsList2 = JSON.parse(req.body.ids);
      var subDataIdsList = searchResult.MetaDataInformationIds;
      
      SubmissionInfoModel.find({ _id: { $in : subDataIdsList }}, async function(err, subDatas){
        if(err){
          console.log("Error retrieving meta data information from DB: " + err);
        } else{
          console.log(subDatas);
          // create lists of allIds of raw files and submission infos corresponding to requested meta data file
          //var rawFileUrl = [];
          var submissionInfoIds = [];
          var submissionInfos = [];
          var downloadUrls = [];
          var readMeFileUrls=[];
          //var metaFileurl = [];
          

          for(var subData of subDatas){
              // get raw file corresponding to this data row
              var rawFileUrl = [];
              var subs=[];
              var zipSub = [];
              // get submission corrsponding to this data row
              var submission = await SubmissionModel.findById(subData.submissionId);

              //var metaFileUrl = submission.metaFilePath;
              subs.push(path.resolve(path.normalize(submission.metaFilePath)));
              //console.log("meta file path:"+submission.metaFilePath);
              //console.log("raw file path:"+submission.rawFilePath);

              //add raw file url
              subs.push(path.resolve(path.normalize(submission.rawFilePath)));
              //rawFileUrl.push(path.resolve(path.normalize(submission.rawFilePath)));
              //var zipRaw = zipHelper.zip(rawFileUrl, "rawFiles");
              //subs.push(rawFileUrl);


              //add readme file 
              var readMeFiles = await ReadMeFileModel.findById(submission.readMeFileId);
              subs.push(path.resolve(path.normalize(readMeFiles.path)));

              //submissionInfoIds.push(submission.submissionInfoId);
              var submissionInfo = await SubmissionInfoModel.findById(submission.submissionInfoId);
              submissionInfos.push(submissionInfo); 

              zipSub = zipHelper.zip(subs, "SubmissionNo-"+subData.submissionId);
              downloadUrls.push(zipSub);
              //zipSubmission = zipHelper.zip(rawFileUrls, "rawFiles"); 
            }
          // submission info data file location
          var submissionInfoFileLocation = 'downloads/submissionInfo' + '-' + rand + '.csv';
            
          // generate submission info file content (json to csv)
          var submissionInfoFileContent = generateSubmissionInfoFileContent(submissionInfos); 

          // write submission info content to file
          fs.writeFileSync(submissionInfoFileLocation, submissionInfoFileContent);

            // add submission info file to files list 
            downloadUrls.push(submissionInfoFileLocation);

            var zipFile = zipHelper.zip(downloadUrls,"ResearchData-BySubmission");

            //send file to user
            res.set('Content-Type','application/zip');
            //var stat = fs.statSync(zipFile);
            res.setHeader('Content-Disposition', 'attachment; filename='+path.resolve(path.normalize(zipFile)));
            //res.setHeader("Content-Length",stat.size);
            res.download(path.resolve(path.normalize(zipFile)), function (err) {
              if (err) {
                // Handle error, but keep in mind the response may be partially-sent
                // so check res.headersSent
                console.log("download error " + err);
              } else {
                // decrement a download credit, etc.
              }
            });
          
                
        }
      });
    }
  });
};


// TODO: Move to database 
const searchTerms = ["institutioncode",
"collectioncode",
"cataloguenumber",
"class",
"order",
"family",
"genus",
"infraSpecificepithet",
"specificepithet",
"sex",
"lifestage",
"country",
"patch"];

// helper methods
async function extractSearchQueryFromReq(reqBody) {
  var query = {};

  if (reqBody.name) {
    let name = reqBody.name;
    query.name = name.trime();
  }
  if (reqBody.institute) {
    let institute = reqBody.institute;
    query.institute = institute.trim();
  }
  if (reqBody.submissionId) {
    let submissionId = reqBody.submissionId;
    query.submissionId = submissionId.trim();
  }
  if (reqBody.typeOfData) {
    let typeOfData = reqBody.typeOfData;
    query.typeOfData = typeOfData.trim();
  }
  if (reqBody.dataFrom) {
    let dataFrom = reqBody.dataFrom;
    query.dataFrom = dataFrom.trim();
  }
  if (reqBody.doi) {
    let doi = reqBody.doi;
    query.doi = doi.trim();
  }

  return query;
}

function getSearchTermsFor(reqBody,field){
  return reqBody[field] == null || reqBody[field] == "" ? null : reqBody[field];
}

function generateSubmissionInfoFileContent(submissionInfos) {
  const fields = [  'submissionId',
                    'recordId',
                    'researchId',
                    'metaDataCollectionId',
                    'typeOfData',
                    'published',
                    'reference',
                    'doi',
                    'embargo',
                    'releaseDate',
                    'institute'];
                    
  
  try {
    const parser = new Parser({ fields, quote: '' });
    const csv = parser.parse(submissionInfos);
    return csv;
  } catch (err) {
    console.error(err);
  }
}

function generateMetaFileContent(metaData) {
  const fields = [  
'submissionInfoId',
'rawFileName',
'datasource',
'uniqueid',
'recordid',
'institutioncode',
'cataloguenumber',
'collectioncode',
'genus',
'specificepithet',
'patch',
'lightangle1',
'lightangle2',
'probeangle1',
'probeangle2',
'replicate',
'uniqueid',

'field',
'class',
'order',
'family',
'infraSpecificepithet',
'sex',
'lifestage',
'country'];
  
  try {
    const parser = new Parser({ fields, quote: '' });
    var csv = parser.parse(metaData);
    return csv;
  } catch (err) {
    console.error(err);
  }
}

// WHAT IS THIS??!!
function generateMetaFile(metaDataIdsList) {
  var metaFile = generateMetaFile(metaDataIdsList);
  var rawFilesUrls = getRawFilesUrls(metaDataIdsList);
  var zipFile = zipFiles(metaFile,rawFilesUrls);  
  res.download(zipFile);
  var metaDataInformations = MetaDataInformationModel.find(metaDataIdsList, function (err, docs) { });
  return metaDataInformations;
}




// Deprecated Not Used Any more, use downloadSearchResult
exports.downloadResults = function(req, res, next) {
  //console.log(req.body);
  var rand = uuidv1();
  var metaDataIdsList = JSON.parse(req.body.ids);
  
  MetaDataInformationModel.find({ _id: { $in : metaDataIdsList }}, async function(err, metaDatas){
    if(err){
      console.log("Error retrieving meta data information from DB: " + err);
    } else{

      // create lists of allIds of raw files and submission infos corresponding to requested meta data file
      var rawFileUrls = [];
      var submissionInfoIds = [];
      var submissionInfos = [];

      for(var metaData of metaDatas){
        // get raw file corresponding to this data row
        var rFile = await RawFileModel.findById(metaData.rawFileId);
        rawFileUrls.push(path.resolve(path.normalize(rFile.path)));
        metaData.rawFileName = rFile.name;
        
        // get submission corrsponding to this data row
        var submission = await SubmissionModel.findById(rFile.submissionId);
        metaData.submissionInfoId = submission.submissionInfoId;
        if (submissionInfoIds.indexOf(submission.submissionInfoId) === -1) {
          submissionInfoIds.push(submission.submissionInfoId);

          var submissionInfo = await SubmissionInfoModel.findById(submission.submissionInfoId);
          submissionInfos.push(submissionInfo); 
        }
      }
      
      // submission info data file location
      var submissionInfoFileLocation = 'downloads/submissionInfo' + '-' + rand + '.csv';
        
      // generate submission info file content (json to csv)
      var submissionInfoFileContent = generateSubmissionInfoFileContent(submissionInfos); 

      // write submission info content to file
      fs.writeFileSync(submissionInfoFileLocation, submissionInfoFileContent);

      // meta data file location
      var metaFileLocation = 'downloads/metaData' + '-' + rand + '.csv';

      // generate meta data file content (json to csv)
      var metaDataFileContent = generateMetaFileContent(metaDatas); 

      // write meta data to meta data file
      fs.writeFile(metaFileLocation, metaDataFileContent, 'utf8', function (err) {
        if (err) {
          console.log('Some error occured - file either not saved or corrupted file saved.');
        } else{
          console.log('Meta Data file saved!');

          // add submission info file to files list 
          rawFileUrls.push(submissionInfoFileLocation);

          // add meta data file to files list 
          rawFileUrls.push(metaFileLocation);

          //Zip all raw files with meta data file and submission info file
          var zipFile = zipHelper.zip(rawFileUrls);  

          //send file to user
          res.set('Content-Type','application/octet-stream');
          var stat = fs.statSync(zipFile);
          res.setHeader('Content-Disposition', 'attachment; filename='+path.resolve(path.normalize(zipFile)));
          res.setHeader("Content-Length",stat.size);
          res.download(path.resolve(path.normalize(zipFile)), function (err) {
            if (err) {
              // Handle error, but keep in mind the response may be partially-sent
              // so check res.headersSent
              console.log("download error " + err);
            } else {
              // decrement a download credit, etc.
            }
          });
        }
      });      
    }
  });
};