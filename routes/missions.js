var express = require('express');
var path = require('path');
var router = express.Router();

var missionsPath = path.join(__dirname, '../missions');

router.get('/', function (req, res) {
  var fs = require('fs');
  var files = fs.readdir(missionsPath, (err, files) => {
    if (err) {
      console.log(err);
    } else {
      res.json(files.filter(function(file) { return file.endsWith('.log'); }));
    }
  });
});

router.use(express.static(missionsPath));

module.exports = router;
