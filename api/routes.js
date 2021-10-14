const router = require('express').Router();

router.use('/test',require('./testjs.js'))

module.exports = router;