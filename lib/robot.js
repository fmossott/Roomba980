'use strict';

var config = require('config');
var dorita980 = require('dorita980');
var fs = require('fs');
var path = require('path');
const EventEmitter = require('events');


var blid = process.env.BLID || config.blid;
var password = process.env.PASSWORD || config.password;
var robotIP = process.env.ROBOT_IP || config.robotIP;
var knownIP = robotIP;
var firmwareVersion = parseInt((process.env.FIRMWARE_VERSION || config.firmwareVersion || 1), 10);
var enableLocal = process.env.ENABLE_LOCAL || config.enableLocal || 'yes';
var enableCloud = process.env.ENABLE_CLOUD || config.enableCloud || 'yes';
var keepAlive = process.env.KEEP_ALIVE || config.keepAlive || 'yes';

var missionsPath = path.join(__dirname, '../missions');

// Temporal:
if (firmwareVersion === 2) enableCloud = 'no';

if (!blid || !password) {
  throw new Error('Config not found. Please edit config/default.json file with your robot credentials. Or set BLID, PASSWORD and ROBOT_IP enviroment variables.');
}

var myRobot = new EventEmitter();

var handleIP = (robotIP || enableLocal === 'no') ? function (cb) { cb(null, robotIP); } : dorita980.getRobotIP;

var connected=false;

function connect() {
  handleIP(function (e, ip) {
    if (e) throw e;
    knownIP = ip;
    if (enableLocal === 'yes') {
      if (firmwareVersion === 1 || (keepAlive === 'yes')) {
        myRobot.local = new dorita980.Local(blid, password, ip, firmwareVersion);
        
        myRobot.local.on('update', function (msg) {
          if (msg && msg.state && msg.state.reported && ( msg.state.reported.pose || msg.state.reported.cleanMissionStatus || msg.state.reported.batPct || msg.state.reported.bin)) {
            var filename=new Date().toISOString();
            myRobot.emit('update',msg.state.reported);
            fs.appendFile(path.join(missionsPath,new Date().yyyymmdd()+'.log'), JSON.stringify(msg.state.reported)+'\n', { mode: 0o666 }, function (err) {
              if (err) throw err;
            });
          }
        });
        
        myRobot.local.on('connect', function () {
          connected=true;
          console.log('Robot connected');
        });

        myRobot.local.on('close', function (err) {
          console.log('Robot connection closed: '+err.message);

//          if (connected) setTimeout( connect, 1000 );
          
          connected=false;
        });
        
      }
    }
    if (enableCloud === 'yes') myRobot.cloud = new dorita980.Cloud(blid, password, firmwareVersion);
  });
}

connect();


module.exports = myRobot;
