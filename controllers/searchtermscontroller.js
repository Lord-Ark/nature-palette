var express = require('express');
const app = express();

const fs = require('fs');
const path = require('path');
const moment = require('moment');
var mongoose = require('mongoose');

var SearchTermModel = require('../models/SearchTermModel');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function isEnabledValue(value) {
  return value === 'on';
}

async function getEnabledSearchTerms() {
  let terms = await SearchTermModel.find({Enabled: true});
  return terms;
}

async function getSearchTerms() {
  let terms = await SearchTermModel.find();
  return terms;
}

async function getSearchTerm(id) {
  let term = await SearchTermModel.findOne({_id: id});
  return term;
}

async function getSearchTermByName(name) {
  let term = await SearchTermModel.findOne({Name: name});
  return term;
}

// get search terms
exports.getSearchTerms = function(req, res) {
  getSearchTerms().then( function (searchTermList) {
    res.render('searchTerms', {searchTerms: searchTermList, error: null, user: req.user});    
  })
};

// edit search term
exports.editSearchTerm = function(req, res) {
  return getSearchTerm(req.body.Id).then( function (searchTerm) {
    if (searchTerm == null) {
      return getSearchTerms().then(function (searchTermList) {
        res.render('searchTerms', {
          searchTerms: searchTermList,
          error: 'Search Term Not Found!',
          user: req.user
        });
      });
    }
    
    if (searchTerm != null) {
      searchTerm.Placeholder = normalizeText(req.body.Placeholder);
      searchTerm.Enabled = isEnabledValue(req.body.isEnabled);

      return searchTerm.save().then(function () {
        return getSearchTerms().then( function (searchTermList) {
          res.render('searchTerms', {searchTerms: searchTermList, error: null, user: req.user});    
        }) 
      });
    }

  })
};
// Delete search term
exports.deleteSearchTerm = function(req, res) {
  return getSearchTerm(req.body.Id).then( function (searchTerm) {
    if (searchTerm == null) {
      return getSearchTerms().then(function (searchTermList) {
        res.render('searchTerms', {
          searchTerms: searchTermList,
          error: 'Search Term Not Found!',
          user: req.user
        });
      });
    }
    
    //if(typeof searchTerm != undefined && searchTerm != null){
    //searchTerm.Placeholder = req.body.Placeholder;  
      
    //  if(typeof req.body.isEnabled != undefined && req.body.isEnabled != null && req.body.isEnabled == "on"){
      //  searchTerm.Enabled = true;  
      //}else{
        //searchTerm.Enabled = false
      //}

      return searchTerm.remove().then(function () {
        return getSearchTerms().then( function (searchTermList) {
          res.render('searchTerms', {searchTerms: searchTermList, error: null, user: req.user});    
        }) 
      });
  })
};

// add search term
exports.addSearchTerm = function(req, res) {
  const normalizedName = normalizeText(req.body.Name);
  const normalizedPlaceholder = normalizeText(req.body.Placeholder);

  if (normalizedName == null || normalizedName === "") {
    return getSearchTerms().then(function (searchTermList) {
      res.render('searchTerms', {
        searchTerms: searchTermList,
        error: "Search Term Name Required!",
        user: req.user
      });
    });
  }
  
  getSearchTermByName(normalizedName).then(function (searchTerm) {
    if(searchTerm!=null){
      getSearchTerms().then( function (searchTermList) {
        res.render('searchTerms', {searchTerms: searchTermList, error: "Search Term Already Exists!", user: req.user});    
      }) ;
      return;
    }

    var newTerm = {};
    newTerm.Name = normalizedName;
    newTerm.Placeholder = normalizedPlaceholder;
    newTerm.Enabled = isEnabledValue(req.body.isEnabled);
    
    SearchTermModel.create(newTerm, function (err, term_instance) {
      if (err){
        console.log("search term save ERROR! " + err);
        return false;
      }
  
      getSearchTerms().then( function (searchTermList) {
        res.render('searchTerms', {searchTerms: searchTermList, error: null, user: req.user});    
      }) ;
    });    
  })
};
