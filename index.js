var express = require('express');
var app = express();
var router = express.Router();
var cookieParser = require('cookie-parser');

var port = 3000;


app.get('/', function (req, res) {
    res.sendFile(__dirname + `/public/page/index.html`);
})

// Defining the Middlewares 

app.use(express.json());
app.use(cookieParser());

app.use(express.static(__dirname + '/public'));
app.use('/api', require('./api/routes.js'));
app.use('/', router);



app.listen(port, function () {
    console.log('Running on Port' + port)
});

module.exports = app;