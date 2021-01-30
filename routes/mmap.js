const express = require('express');
const router = express.Router();

router.get('/', function (req, res) {
  res.render('mmap', { title: 'Roomba Map', rootPath: '.' });
});

module.exports = router;
