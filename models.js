//models.js
const mongoose = require('mongoose');

// ===============
// Database Config
// ===============
mongoose.connect('mongodb://localhost:27017/NPS', {useNewUrlParser: true, useUnifiedTopology: true});
//mongoose.connect('mongodb+srv://naturepalette:naturepalette@cluster0-bps0e.mongodb.net/NPS?retryWrites=true&w=majority', {useNewUrlParser: true});

var db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));

