var express = require('express');
const path = require('path');

const fs = require('fs');
const { Console } = require('console');
const app = express();

const reflectance_meta_file_header_fields = [
    "filename",
    "datasource",
    "uniqueid",
    "institutioncode",
    "cataloguenumber",
    "genus",
    "specificepithet",
    "patch",
    "lightangle1",
    "lightangle2",
    "probeangle1",
    "probeangle2",
    "replicate"
    ];
const reflectance_field_header_fields = [
  "filename",
  "datasource",
  "uniqueid",
  "genus",
  "specificepithet",
  "patch",
  "lightangle1",
  "lightangle2",
  "probeangle1",
  "probeangle2",
  "replicate"
  ];
const reflectance_museum_header_fields = [
  "filename",
  "datasource",
  "institutioncode",
  "cataloguenumber",
  "genus",
  "specificepithet",
  "patch",
  "lightangle1",
  "lightangle2",
  "probeangle1",
  "probeangle2",
  "replicate"
  ];
////////////////////////////////// meta file header template for modification //////////////////////////////////
  const modify_reflectance_meta_file_header_fields = [
    "oldfilename",
    "filename",
    "datasource",
    "uniqueid",
    "institutioncode",
    "cataloguenumber",
    "genus",
    "specificepithet",
    "patch",
    "lightangle1",
    "lightangle2",
    "probeangle1",
    "probeangle2",
    "replicate"
    ];
  
  const modify_reflectance_museum_header_fields = [
    "oldfilename",
    "filename",
    "datasource",
    "institutioncode",
    "cataloguenumber",
    "genus",
    "specificepithet",
    "patch",
    "lightangle1",
    "lightangle2",
    "probeangle1",
    "probeangle2",
    "replicate"
    ];
  
  const modify_reflectance_field_header_fields = [
    "oldfilename",
    "filename",
    "datasource",
    "uniqueid",
    "genus",
    "specificepithet",
    "patch",
    "lightangle1",
    "lightangle2",
    "probeangle1",
    "probeangle2",
    "replicate"
    ];
  

exports.verifyUploadRequest = function(req,err) {
  // verify request has exactly 3 files
  if (!req.files) //|| Object.keys(req.files).length != 3) 
  {
  	err.details = "Wrong number of files selected!"
    return false;
  }

  // verify request has rawFile, metaFile, Readme files with correct file types
  if (!req.files.rawFile || path.extname(req.files.rawFile.name) != '.zip') {
  	err.details = "Raw file is missing or selected file type is not supported!"
    return false;
  }
  if (!req.files.metaFile || path.extname(req.files.metaFile.name) != '.csv'  ) {
  	err.details = "Metadata file is missing or selected file type is not supported!"
    return false;
  }
  // if (!req.files.readMeFile || path.extname(req.files.readMeFile.name) != '.txt'  ) {
  // 	err.details = "README file is missing or selected file type is not supported!"
  //   return false;
  // }
  // TODO: All Other 'online' request-related verifications 

  return true;
}

////////////////////////for new submission/////////////////////////////////////

exports.verifyMetaFileHeaderFields = function (metaFileUrl,err) {
  err.details = "";
    
  // verify if each column is existing
  var metaFileHeaderFields = [];
  var fileContents = fs.readFileSync(metaFileUrl);
  var lines = fileContents.toString().split('\n');
  
  metaFileHeaderFields = lines[0].toString().split(',').map(element => {
    return element.toLowerCase().trim();
  });

  var reference_header_fields = reflectance_meta_file_header_fields;

  missingColumn = [];
  
  for(var i =0;i<reference_header_fields.length;i++){
    // check = meta_file_obj_arr[i].replace(/\s/g, "");
    if(!metaFileHeaderFields.includes(reference_header_fields[i])){
      missingColumn.push(reference_header_fields[i]);
    }
  }
  
  if(missingColumn.length > 0){
    err.details = "Meta File Header is missing the following fields: " + missingColumn.join();
  return false;
  }
  
  return true;
}

//////////////////////// For Modification  ///////////////////////////// 

exports.modifyVerifyMetaFileHeaderFields = function (metaFileUrl,err) {
  err.details = "";
  // verify if each column is existing
  var metaFileHeaderFields = [];
  var fileContents = fs.readFileSync(metaFileUrl);
  var lines = fileContents.toString().split('\n');
  
  metaFileHeaderFields = lines[0].toString().split(',').map(element => {
    return element.toLowerCase().trim();
  });

  var reference_header_fields = modify_reflectance_meta_file_header_fields;

  missingColumn = [];
  
  for(var i =0;i<reference_header_fields.length;i++){
    // check = meta_file_obj_arr[i].replace(/\s/g, "");
    if(!metaFileHeaderFields.includes(reference_header_fields[i])){
      missingColumn.push(reference_header_fields[i]);
    }
  }
  if(missingColumn.length > 0){
      err.details = "Meta File Header is missing the following fields: " + missingColumn.join();
      return false;
  }
  return true;
}

  //////////////////////////////for new submission////////////////////////////////////////////////
exports.verifyAndGetMetaDataRows = function (metaFileUrl,err) {
  err.details = "";

  var fileContents = fs.readFileSync(metaFileUrl);
  var lines = fileContents.toString().split('\n').filter(x=>x!=null&&x!="");
  if(lines.length<1){
    err.details = "Meta File Error, file has no contents!";
    return false;
  }
  var headers = lines[0].toString().split(',');
  console.log(headers)
  if(lines.length<2){
    err.details = "Meta File Error, file has no contents other than header!";
    return false;
  }
  var dataSourceIndex = getDataSourceColumnIndex(lines[0]);
  if(dataSourceIndex== undefined){
    err.details = "Meta File Error!";
    return false;
  }
  var fileNameColIndex = getRawFileNameColumnIndex(lines[0]);
  metaDataField= "F"
  metaDataMuseum= "M"
  var requiredFieldsIndicesField = getRequiredFieldsColumnsIndicesField(lines[0],metaDataField);
  console.log(requiredFieldsIndicesField)
  var requiredFieldsIndicesMuseum = getRequiredFieldsColumnsIndicesMuseum(lines[0], metaDataMuseum);
  console.log(requiredFieldsIndicesMuseum)
  
  metaDataRows = [];
  rawFileNames = [];
  missingValue = [];
  contentError = [];
  duplication = [];
  missingDataSource = [];
  for(var i =1;i<lines.length;i++){
    var values = lines[i].toString().split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/g);
    //console.log(" value " + values);
    if(values[dataSourceIndex] == undefined && values[dataSourceIndex]== null){
        var z= i + 1;
        err.details = "Meta File Error, file has no contents other than header!";
        missingDataSource.push(headers[dataSourceIndex] + " in line : " + z)

    }else{
        var dataSource = values[dataSourceIndex].trim();
        //console.log(dataSource)
        if(dataSource == "M"){
          // make sure all required field are present
          for (const requiredMuseumIndex of requiredFieldsIndicesMuseum) {
              if( values[requiredMuseumIndex] == undefined && values[requiredMuseumIndex] == null){
                  var y = i+1;
                  contentError.push(y + " ");
                  break;
              } else{
              var requiredMuseumValue = values[requiredMuseumIndex].trim();
                  if( requiredMuseumValue == null || requiredMuseumValue == ""){
                      var x= i + 1;
                      missingValue.push(headers[requiredMuseumIndex] + " in line : " + x);
                      
                  }
              }
            }
        } else {
            // make sure all required field are present
            for (const requiredFieldIndex of requiredFieldsIndicesField) {
              //console.log(values[requiredFieldIndex])
                if( values[requiredFieldIndex] == undefined && values[requiredFieldIndex] == null){
                    var y = i+1;
                    contentError.push(y + " ");
                    break;
                } else{
                var requiredFieldValue = values[requiredFieldIndex].trim();
                    if( requiredFieldValue == null || requiredFieldValue == ""){
                        var x= i + 1;
                        missingValue.push(headers[requiredFieldIndex] + " in line  : " + x);
                        
                    }
                }
            }
        } 
     }
    // extract values of this row into an object
    var metaDataRow = {};
    headers.forEach(function(element,index) {
      metaDataRow[element.toLowerCase().trim()]  = values[index];      
    });

    // add this row to list of rows 
    metaDataRows.push(metaDataRow);

    // add filename of this row into file names list  
    var fileName = values[fileNameColIndex].trim();
    rawFileNames.push(fileName);
  }
  var error = "";
  var error1= "";
  var error2= "";
  var error3= "";
  if(contentError.length > 0 || missingValue.length > 0 || missingDataSource.length > 0 || arrayHasDuplication(rawFileNames, err) ){
    if(contentError.length > 0){
      error = 'Meta File Error, Please check these suggested rows in meta file. Some of these rows may contain invalid characters or line break. : ' + contentError.join(); 
      //return false;
    }
    if(missingValue.length > 0){
      error1 =  'Meta File Error, no value found for required field ' + missingValue.join();
    //return false;
    }
    if(arrayHasDuplication(rawFileNames, err)){
      error2 = ' Meta File Error, raw file name duplication: ' + err.details;
    }
    if(missingDataSource.length > 0){
      error3= 'Meta File Error, no value found for DataSource column';
    }
    err.details = error +'\n\n'+ error1 +'\n\n'+ error2+'\n\n'+ error3;
    console.log(err.details);
    return false;
  }
  return metaDataRows;
}


////////////////////for modification////////////
exports.modifyVerifyAndGetMetaDataRows = function (metaFileUrl,err) {
  err.details = "";

  var fileContents = fs.readFileSync(metaFileUrl);
  var lines = fileContents.toString().split('\n').filter(x=>x!=null&&x!="");
  if(lines.length<1){
    err.details = "Meta File Error, file has no contents!";
    return false;
  }
  var headers = lines[0].toString().split(',');

  if(lines.length<2){
    err.details = "Meta File Error, file has no contents other than header!";
    return false;
  }
  var fileNameColIndex = getRawFileNameColumnIndex(lines[0]);
  metaDataRows = [];
  rawFileNames = [];
  duplication = [];

  for(var i =1;i<lines.length;i++){
    var values = lines[i].toString().split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/g);
    
    // extract values of this row into an object
    var metaDataRow = {};
    headers.forEach(function(element,index) {
      metaDataRow[element.toLowerCase().trim()]  = values[index];      
    });

    // add this row to list of rows 
    metaDataRows.push(metaDataRow);

    // add filename of this row into file names list  
    var fileName = values[fileNameColIndex].trim();
    rawFileNames.push(fileName);
  }
    if(arrayHasDuplication(rawFileNames, err)){
      err = ' Meta File Error, raw file name duplication: ' + err.details;
      return false;
    }
  return metaDataRows;
}




// get metadata rows to match the file name with raw files
exports.getMetaDataRows = function (metaFileUrl,err) {

  var fileContentstest = fs.readFileSync(metaFileUrl);
  var lines = fileContentstest.toString().split('\n').filter(x=>x!=null&&x!="");
  var headers = lines[0].toString().split(',');
  metaDataRowstest = [];

  for(var i =1;i<lines.length;i++){
    var values = lines[i].toString().split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/g);
    //console.log(" value " + values);
    
    // extract values of this row into an object
    var metaDataRowtest = {};
    headers.forEach(function(element,index) {
      metaDataRowtest[element.toLowerCase().trim()]  = values[index];      
    });

    // add this row to list of rows 
    metaDataRowstest.push(metaDataRowtest);

  }
   //console.log(metaDataRowstest)

  return metaDataRowstest;
}
////new submission//////
getRequiredFieldsColumnsIndicesField = function (metaFileHeaderLine) {
  //console.log(metaFileType)
  metaFileHeaderFields = metaFileHeaderLine.toString().split(',').map(element => {
    return element.toLowerCase().trim();
  });
  var reference_header_fields =  reflectance_field_header_fields;
  requiredHeaderFieldIndicesField = [];
  for (const headerField of reference_header_fields) {
    //console.log ("required header " + headerField);
    requiredHeaderFieldIndicesField.push(metaFileHeaderFields.findIndex(x=>x==headerField));
  }
  return requiredHeaderFieldIndicesField;
}

getRequiredFieldsColumnsIndicesMuseum = function (metaFileHeaderLineM) {
  //console.log(metaFileType)
  metaFileHeaderFields_m = metaFileHeaderLineM.toString().split(',').map(element => {
    return element.toLowerCase().trim();
  });
  var reference_header_fields_Museum = reflectance_museum_header_fields;
  requiredHeaderFieldIndicesMuseum = [];
  for (const headerField_m of reference_header_fields_Museum) {
    //console.log ("required header " + headerField);
    requiredHeaderFieldIndicesMuseum.push(metaFileHeaderFields_m.findIndex(x=>x==headerField_m));
  }
  return requiredHeaderFieldIndicesMuseum;
}


///////for modification/////////////
// modifyGetRequiredFieldsColumnsIndices = function (metaFileHeaderLine,metaFileType) {
//   metaFileHeaderFields = metaFileHeaderLine.toString().split(',').map(element => {
//     return element.toLowerCase().trim();
//   });

//   reference_header_fields = modifyGetReferenceHeaderFields(metaFileType);
//   //console.log ("required ref header " + reference_header_fields);
//   //console.log ("required meta header " + metaFileHeaderFields);
//   requiredHeaderFieldIndices = [];
//   for (const headerField of reference_header_fields) {
//     //console.log ("required header " + headerField);
//     requiredHeaderFieldIndices.push(metaFileHeaderFields.findIndex(x=>x==headerField));
//   }

  
//   //console.log ("required header indices " + requiredHeaderFieldIndices);
//   return requiredHeaderFieldIndices;
// }


getDataSourceColumnIndex = function (metaFileHeaderLine) {

    //console.log(metaFileHeaderLine)
    metaFileHeaderFields = metaFileHeaderLine.toString().split(',').map(element => {
      return element.toLowerCase().trim();
    });
    
    return metaFileHeaderFields.findIndex(x=>x=="datasource");
  }

getRawFileNameColumnIndex = function (metaFileHeaderLine) {
  
  metaFileHeaderFields = metaFileHeaderLine.toString().split(',').map(element => {
    return element.toLowerCase().trim();
  });
  
  return metaFileHeaderFields.findIndex(x=>x=="filename");
}

arrayHasDuplication = function(array,err) {
  var alreadySeen = [];

  for (const str of array){
    if (alreadySeen.indexOf(str)>-1){
      duplication.push(str);
    }
    alreadySeen.push(str);
  }
  if(duplication.length >0){
    let unique=[...new Set(duplication)];
    err.details = unique.join();
    return true;

  } else
      return false;
}


////////////  for normal submission  ////////////
// getReferenceHeaderFields = function (metaFileType) {  
//   //console.log(metaFileType)
//   if(metaFileType === "M")
//   {
//     var reference_header_fields = reflectance_museum_header_fields;
//   }
//   else
//   {
//     var reference_header_fields = reflectance_field_header_fields;
//   }
  
//   return reference_header_fields;
// }


// /////////////  for data modification  //////////////
// modifyGetReferenceHeaderFields = function (metaFileType) {  
//   if(metaFileType === "M")
//   {
//     var reference_header_fields =  modify_reflectance_museum_header_fields;
  
//   }
//   else
//   {
//     var reference_header_fields = modify_reflectance_field_header_fields;
//   }
//   return reference_header_fields;
// }

