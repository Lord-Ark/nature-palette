const router = require('express').Router();

router.post('/returntest',function(req,res){
    res.statusCode(200).json({Message: "Success"})
})

module.exports = router;