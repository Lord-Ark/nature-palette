var express = require('express');
const app = express();

const fs = require('fs');
const path = require('path');
const moment = require('moment');
var mongoose = require('mongoose');
var { PolyUtil } = require("node-geometry-library");
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
//get delete page
exports.deleteData = function (req, res) {
  res.render('clearDatabase', { error: null, user: req.user });
};
// drop MetaDataInformation Collection (For testing only)
exports.clearAll = function (req, res) {
  MetaDataInformationModel.collection.drop();
  SubmissionModel.collection.drop()
  SubmissionInfoModel.collection.drop();
  MetaDataFileModel.collection.drop();
  RawFileModel.collection.drop();
  MetricsModel.collection.drop();

  getEnabledSearchTerms().then(function (searchTermList) {
    res.render('search', { searchResult: null, searchTerms: searchTermList, error: null, user: req.user, input: null });
  })
};

async function getEnabledSearchTerms() {
  let terms = await SearchTermModel.find({ Enabled: true });
  return terms;
}

// get search page
exports.getSearch = function (req, res) {
  getEnabledSearchTerms().then(function (searchTermList) {
    // console.log(searchTermList, '-----------')
    res.render('search', { searchResult: null, searchTerms: searchTermList, error: null, user: req.user, input: null });
  })
};

// get search result 
exports.postSearch = function (req, res, next) {
  extractSearchQueryFromReq(req.body).then(function (query) {
    var columns = '_id rawFileId cataloguenumber genus specificepithet infraspecificepithet sex lifestage patch url decimallatitude decimallongitude';
    console.log(query);
    MetaDataInformationModel.find(query, columns, async function (err, metaDatas) {
      if (err) {
        console.log("Error retrieving meta data information from DB: " + err);
      } else {
        var searchResultIns = {};
        searchResultIns._id = mongoose.Types.ObjectId();

        var results = [];
        var resultsSigList = [];
        var ids = [];
        var resultMetadats = [];
        let polygonbounds = []
        for (var metaRow of metaDatas) {
          resultMetadats.push(getSearchRowSignature(metaRow));
        }

        if (req.body.polyCoordinates && req.body.polyCoordinates != null) {
          console.log(req.body.polyCoordinates, '---')
          let polyBounds = req.body.polyCoordinates;
          let boundsplit = polyBounds.split("_")

          for (let i = 0; i < boundsplit.length; i = i + 2) {
            polygonbounds.push({ lat: parseFloat(boundsplit[i]), lng: parseFloat(boundsplit[i + 1]) });
          }

        }

        for (var metaData of metaDatas) {
          // push id into ids list 
          //console.log("ids are:" + metaData._id);
          ids.push(metaData._id);

          var sig = getSearchRowSignature(metaData);
          var count = resultMetadats.filter(x => x === sig).length;
          if (resultsSigList.indexOf(sig) === -1) {
            // create result object and fill metadata info
            var result = {};
            result.SearchResultId = searchResultIns._id;
            result.TotalSearchResultCount = metaDatas.length;
            result._id = metaData._id;
            result.rawFileId = metaData.rawFileId;
            result.genus = metaData.genus;
            result.specificepithet = metaData.specificepithet;
            result.infraspecificepithet = metaData.infraspecificepithet;
            result.sex = metaData.sex;
            result.lifestage = metaData.lifestage;
            result.patch = metaData.patch;
            result.cataloguenumber = metaData.cataloguenumber;
            result.count = count;

            result.latitude = metaData.decimallatitude;
            result.longitude = metaData.decimallongitude;

            let responseMap = true
            if(polygonbounds.length>0){
              responseMap = PolyUtil.containsLocation(
                { lat: result.latitude, lng: result.longitude }, // point object {lat, lng}
                polygonbounds
              );
            }
            
            //var rFile = await RawFileModel.findById(metaData.rawFileId);
            //result.url = path.resolve(path.normalize(rFile.path));
            if (responseMap)
              results.push(result);
            resultsSigList.push(sig);
          }
        }

        //save ids in search result
        searchResultIns.MetaDataInformationIds = ids;

        // save search result
        SearchResultModel.create(searchResultIns, function (err, searchResult_instance) {
          if (err) {
            console.log("SearchResult save ERROR! " + err);
            return false;
          }
        });

        var ret = JSON.stringify(results);

        getEnabledSearchTerms().then(function (searchTermList) {
          res.render('search', { searchResult: results, searchTerms: searchTermList, error: null, user: req.user, input: req.body });
          //console.log('retrieved meta data information', ret);
          return;
        })
      }
    });
  });
};

function getSearchRowSignature(row) {
  if (row != undefined && row != "") {
    return row.cataloguenumber + row.genus + row.specificepithet + row.infraspecificepithet + row.sex + row.lifestage + row.patch;
  }
}
//////////////////////////////////// DOWNLOAD////////////////////////////////////////
// download search result
exports.downloadSearchResult = function (req, res, next) {

  SearchResultModel.findOne({ _id: req.body.SearchResultId }, async function (err, searchResult) {
    if (err) {
      console.log("Error retrieving search result from DB: " + err);
    } else {
      //console.log(req.body);
      var rand = uuidv1();

      //var metaDataIdsList2 = JSON.parse(req.body.ids);
      var metaDataIdsList = searchResult.MetaDataInformationIds;

      MetaDataInformationModel.find({ _id: { $in: metaDataIdsList } }, async function (err, metaDatas) {
        if (err) {
          console.log("Error retrieving meta data information from DB: " + err);
        } else {

          // create lists of allIds of raw files and submission infos corresponding to requested meta data file
          var rawFileUrls = [];
          var submissionInfoIds = [];
          var submissionInfos = [];
          var downloadUrls = [];
          var readMeFileUrls = [];

          for (var metaData of metaDatas) {
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
              console.log("readme " + submission.readMeFileId);
              var readMeFiles = await ReadMeFileModel.findById(submission.readMeFileId);
              console.log("here is the problem  " + readMeFiles);
              if (readMeFiles.path != "") {
                downloadUrls.push(path.resolve(path.normalize(readMeFiles.path)));
              }

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
            } else {
              console.log('Meta Data file saved!');

              //Zip all raw files with meta data file and submission info file
              var zipRawFile = zipHelper.zip(rawFileUrls, "rawFiles");

              //add raw files into file list
              downloadUrls.push(zipRawFile);

              // add submission info file to files list 
              downloadUrls.push(submissionInfoFileLocation);

              //add readMe file to files list
              //downloadUrls.push(readMeFileUrls);

              // add meta data file to files list 
              downloadUrls.push(metaFileLocation);

              //console.log(downloadUrls);

              var zipFile = zipHelper.zip(downloadUrls, "ResearchData");

              //send file to user
              res.set('Content-Type', 'application/zip');
              //var stat = fs.statSync(zipFile);
              res.setHeader('Content-Disposition', 'attachment; filename=' + path.resolve(path.normalize(zipFile)));
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
  var searchTermsList = await SearchTermModel.find({ Enabled: true }, 'Name');
  searchTermsList = searchTermsList.map(x => x.Name);

  for (var term of searchTermsList) {
    var termVal = getSearchTermsFor(reqBody, term);
    if (Array.isArray(termVal)) {
      termVal = termVal[0];
    }
    if (termVal != null && termVal != "") {
      var termValsList = termVal.trim().split(' OR ').map(element => {
        //return '/'+element.toLowerCase().trim()+'/i';
        return new RegExp('\\b' + element.toLowerCase().trim() + '\\b', 'i');
      }).filter(function (e) { return e });
      query[term] = { $in: termValsList };
    }
  }
  if (reqBody.mapCoordinate && reqBody.mapCoordinate != '') {
    var splitStr = reqBody.mapCoordinate.split("_");
    const northeast = {}
    const southwest = {}
    northeast.lat = parseFloat(splitStr[0]);
    northeast.lng = parseFloat(splitStr[1]);
    southwest.lat = parseFloat(splitStr[2]);
    southwest.lng = parseFloat(splitStr[3]);

    if (northeast != null && southwest != null) {
      if (southwest.lng < northeast.lng) {
        query.decimallatitude = { $gte: southwest.lat, $lte: northeast.lat }
        query.decimallongitude = { $gte: southwest.lng, $lte: northeast.lng }
      }

      else {
        query = QueryMakerForMapCoordinates(southwest.lat, northeast.lat, southwest.lng, northeast.lng, query)
      }
    }
  }

  return query;
}

function getSearchTermsFor(reqBody, field) {
  return reqBody[field] == null || reqBody[field] == "" ? null : reqBody[field];
}

function generateSubmissionInfoFileContent(submissionInfos) {
  const fields = ['submissionId',
    'recordId',
    'researchId',
    'metaDataCollectionId',
    'typeOfData',
    'dataForm',
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
    'recordid',
    'datasource',
    'uniqueid',
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
  var zipFile = zipFiles(metaFile, rawFilesUrls);
  res.download(zipFile);
  var metaDataInformations = MetaDataInformationModel.find(metaDataIdsList, function (err, docs) { });
  return metaDataInformations;
}

function QueryMakerForMapCoordinates(southwestlat, northeastlat, southwestlng, northeastlng, query) {

  let returnObj = {};
  returnObj = {
    $and: [
      query,
      {
        $or: [
          {
            $and: [
              { 'decimallatitude': { $lte: northeastlat } },
              { 'decimallatitude': { $gte: southwestlat } },
              { 'decimallongitude': { $gte: southwestlng } },
              { 'decimallongitude': { $lte: 180 } }
            ]
          },
          {
            $and: [
              { 'decimallatitude': { $lte: northeastlat } },
              { 'decimallatitude': { $gte: southwestlat } },
              { 'decimallongitude': { $gte: -180 } },
              { 'decimallongitude': { $lte: northeastlng } }
            ]
          }
        ]
      }
    ]
  };
  return returnObj;
}



// Deprecated Not Used Any more, use downloadSearchResult
exports.downloadResults = function (req, res, next) {
  //console.log(req.body);
  var rand = uuidv1();
  var metaDataIdsList = JSON.parse(req.body.ids);

  MetaDataInformationModel.find({ _id: { $in: metaDataIdsList } }, async function (err, metaDatas) {
    if (err) {
      console.log("Error retrieving meta data information from DB: " + err);
    } else {

      // create lists of allIds of raw files and submission infos corresponding to requested meta data file
      var rawFileUrls = [];
      var submissionInfoIds = [];
      var submissionInfos = [];

      for (var metaData of metaDatas) {
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
        } else {
          console.log('Meta Data file saved!');

          // add submission info file to files list 
          rawFileUrls.push(submissionInfoFileLocation);

          // add meta data file to files list 
          rawFileUrls.push(metaFileLocation);

          //Zip all raw files with meta data file and submission info file
          var zipFile = zipHelper.zip(rawFileUrls);

          //send file to user
          res.set('Content-Type', 'application/octet-stream');
          var stat = fs.statSync(zipFile);
          res.setHeader('Content-Disposition', 'attachment; filename=' + path.resolve(path.normalize(zipFile)));
          res.setHeader("Content-Length", stat.size);
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