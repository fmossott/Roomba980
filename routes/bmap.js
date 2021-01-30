const express = require('express');
const router = express.Router();
const jsonfile = require('jsonfile');
const valuesPath = './config/mapvalues.json';

router.get('/', function (req, res) {
  const mapvalues = jsonfile.readFileSync(valuesPath);
  res.render('bmap', { title: 'Roomba Map', mapvalues: mapvalues, rootPath: '.' });
});

router.post('/values', function (req, res) {
  const mapvalues = jsonfile.readFileSync(valuesPath);

  mapvalues.offsetX = req.body.offsetX || mapvalues.offsetX;
  mapvalues.offsetY = req.body.offsetY || mapvalues.offsetY;
  mapvalues.sizeW = req.body.sizeW || mapvalues.sizeW;
  mapvalues.sizeH = req.body.sizeH || mapvalues.sizeH;
  mapvalues.pointIntervalMs = req.body.pointIntervalMs || mapvalues.pointIntervalMs;

  jsonfile.writeFileSync(valuesPath, mapvalues, { spaces: 2 });
  res.json(mapvalues);
});

module.exports = router;
