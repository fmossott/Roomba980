var express = require('express');
require('express-ws')(express);

var path = require('path');
var router = express.Router();
var fs = require('fs');

var jsonfile = require('jsonfile');
var statusPath = './missions/status.json';

var missionsPath = path.join(__dirname, '../missions');

var steps = {};

function getFileInfo (filename) {
  return new Promise((resolve, reject) => {
    var n = filename.slice(0, -4);
    var s = steps[n];
    if (!s) {
      var start = new Date().getTime();
      fs.readFile(path.join(missionsPath, filename), (err, data) => {
        if (err) {
          console.log(err);
          reject(err);
        } else {
          s = 0;
          var lines = data.toString().split('\n');
          lines.forEach((line) => {
            try {
              if (line.charAt(0) === '{') {
                var obj = JSON.parse(line);
                if (obj.pose) s++;
              }
            } catch (e) {
              console.log('Error parsing line "' + line + '": ' + e.stack);
            }
          });
          if (filename === this.status.missionFile) {
            n = 'current';
          } else {
            steps[n] = s;
          }
          console.log(filename + ' has ' + s + ' steps - ' + (new Date().getTime() - start) + 'ms');
          resolve({ name: n, steps: s, url: this.req.baseUrl + '/' + n });
        }
      });
    } else {
      resolve({ name: n, steps: s, url: this.req.baseUrl + '/' + n });
    }
  });
}

router.get('/', function (req, res) {
  var status = jsonfile.readFileSync(statusPath);
  fs.readdir(missionsPath, (err, files) => {
    if (err) {
      console.log(err);
    } else {
      var logFiles = files.filter((file) => {
        return file.endsWith('.log');
      });

      var results = Promise.all(logFiles.map(getFileInfo, { req: req, status: status }));

      results.then(data => res.json(data));
    }
  });
});

function currentLogFile (cb) {
  var status = jsonfile.readFileSync(statusPath);
  cb(path.join(missionsPath, status.missionFile));
}

router.get('/current', function (req, res) {
  currentLogFile((logfile) => {
    res.sendFile(logfile);
  });
});

var myRobot;

function preparews (ws) {
  console.log('WebSocket Connected');

  ws.on('error', function (error) {
    console.log('WebSocket Connection Error: ' + error.toString());
  });
  ws.on('close', function (code, msg) {
    console.log('WebSocket Connection Closed: ' + code + ' ' + msg);
    wsSet.delete(ws);
  });
}

function live (ws) {
  console.log('WebSocket Client Registered');
  wsSet.add(ws);
}

var wsSet = new Set();

router.ws('/status', function (ws, req) {
  preparews(ws);
  ws.mapEventFilter = function (obj) {
    if (obj && (obj.pose || obj.cleanMissionStatus || obj.batPct || obj.bin)) {
      return obj;
    } else {
      return null;
    }
  };
  live(ws);
});

router.ws('/events', function (ws, req) {
  preparews(ws);
  live(ws);
});

router.ws('/loadandevents', function (ws, req) {
  preparews(ws);

  currentLogFile((logfile) => {
    fs.readFile(logfile, (err, data) => {
      live(ws);
      if (err) {
        console.log(err);
      } else {
        var lines = data.toString().split('\n');
        try {
          var maxX = 0;
          var minX = 0;
          var maxY = 0;
          var minY = 0;

          lines.forEach((line) => {
            if (line.charAt(0) === '{') {
              var obj = JSON.parse(line);
              if (obj.pose && obj.pose.point) {
                maxX = Math.max(maxX, obj.pose.point.x);
                minX = Math.min(minX, obj.pose.point.x);
                maxY = Math.max(maxY, obj.pose.point.y);
                minY = Math.min(minY, obj.pose.point.y);
              }
            }
          });
          ws.send(JSON.stringify({maxX, minX, maxY, minY}));
        } catch (e) {
          console.log(e.stack);
        }
        lines.forEach((line) => {
          if (line.charAt(0) === '{') ws.send(line);
        });
        console.log('WebSocket Sent ' + lines.length + ' initial lines');
      }
    });
  });
});

router.get('/:date', function (req, res) {
  var logfile = path.join(missionsPath, req.params.date + '.log');

  res.sendFile(logfile);
});

module.exports = (robot) => {
  myRobot = robot;
  myRobot.on('update', msg => {
    wsSet.forEach(function (ws) {
      var obj = msg;
      if (ws.mapEventFilter) obj = ws.mapEventFilter(msg);
      if (obj) ws.send(JSON.stringify(obj));
    });
  });

  return router;
};
