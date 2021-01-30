const express = require('express');
const router = express.Router();

const helloResponse = {
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
