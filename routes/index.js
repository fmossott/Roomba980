var express = require('express');
var router = express.Router();

var helloResponse = {
  documentation: 'https://github.com/fmossott/Roomba980'
};

router.get('/', function (req, res) {
  helloResponse.pong = new Date();
  res.send(helloResponse);
});

router.get('/ping', function (req, res) {
  helloResponse.pong = new Date();
  res.send(helloResponse);
});

module.exports = router;
