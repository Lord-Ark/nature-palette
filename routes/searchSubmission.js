var express = require('express');
var router = express.Router();

var search_sub_controller = require('../controllers/searchSubmissionController');

router.get('/', search_sub_controller.getSearchSub);

router.post('/', search_sub_controller.postSearchSub);

router.post('/download', search_sub_controller.downloadResults);

router.post('/downloadSearchResult', search_sub_controller.downloadSearchResult)



module.exports = router;
