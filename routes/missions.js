var express = require('express');
var path = require('path');
var expressWs = require('express-ws')(express);
var router = express.Router();
var fs = require('fs');
var url = require('url');

var missionsPath = path.join(__dirname, '../missions');

router.get('/', function (req, res) {
  var baseurl = url.format({protocol: req.protocol, host: req.hostname, pathname: req.baseUrl});

  var files = fs.readdir(missionsPath, (err, files) => {
    if (err) {
      console.log(err);
    } else {
      var result=[];
      files.filter((file) => {
        return file.endsWith('.log'); 
      }).forEach((item) => {
        var n=item.slice(0,-4);
        result.push( { name: n, url: baseurl+'/'+n });
      });
      res.json(result);
    }
  });
});

router.get('/current', function (req, res) {
  var logfile = path.join(missionsPath,new Date().yyyymmdd()+'.log');

  res.sendFile(logfile);
  
});

var myRobot;

function preparews(ws) {
  console.log("WebSocket Connected");

  ws.on('error', function(error) {
      console.log("WebSocket Connection Error: " + error.toString());
  });
  ws.on('close', function(code, msg) {
      console.log('WebSocket Connection Closed: '+code+' '+msg);
      wsSet.delete(ws);
  });
}

function live(ws) {
  console.log('WebSocket Client Registered');
  wsSet.add(ws);
}

var wsSet = new Set();

router.ws('/events', function(ws, req) {
  preparews(ws);
  live(ws);
});

router.ws('/loadandevents', function(ws, req) {
  preparews(ws);

  var logfile = path.join(missionsPath,new Date().yyyymmdd()+'.log');

  fs.readFile(logfile, (err, data) => {
  live(ws);  
    if (err) {
      console.log(err);
    } else {
      lines=data.toString().split('\n');
      try {
        var maxX=0, minX=0, maxY=0, minY=0;
        lines.forEach((line) => {
          if (line.charAt(0)==='{') {
            var obj=JSON.parse(line);
            if (obj.pose && obj.pose.point) {
              maxX=Math.max(maxX,obj.pose.point.x);
              minX=Math.min(minX,obj.pose.point.x);
              maxY=Math.max(maxY,obj.pose.point.y);
              minY=Math.min(minY,obj.pose.point.y);
            }
          }
        });
        ws.send(JSON.stringify({maxX, minX, maxY, minY}));
      } catch (e) {
        console.log(e.stack)        
      }
      lines.forEach((line) => {
        if (line.charAt(0)==='{') ws.send(line);
      });
      console.log('WebSocket Sent '+lines.length+' initial lines');
    }
  });
});

router.get('/:date', function (req, res) {
  var logfile = path.join(missionsPath,req.params.date+'.log');

  res.sendFile(logfile);
  
});

module.exports = module.exports = (robot) => { 
  myRobot=robot;
  myRobot.on('update', msg => {
    wsSet.forEach( function (ws) {
      ws.send(JSON.stringify(msg));      
    });
  });

  return router;
};
