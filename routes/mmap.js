var express = require('express');
var router = express.Router();

router.get('/', function (req, res) {
  res.render('mmap', {title: 'Roomba Map', rootPath: '.'});
});

module.exports = router;
