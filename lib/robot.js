'use strict';

var config = require('config');
var dorita980 = require('dorita980');
var fs = require('fs');
var path = require('path');
const EventEmitter = require('events');

var jsonfile = require('jsonfile');
var statusPath = './missions/status.json';

var blid = process.env.BLID || config.blid;
var password = process.env.PASSWORD || config.password;
var robotIP = process.env.ROBOT_IP || config.robotIP;
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

var status;

try {
  status = jsonfile.readFileSync(statusPath);
  console.log('Current mission file: ' + status.missionFile);
} catch (e) {
  console.log(e.stack);
  status = {};
}

var noneStatus = ['none', 'dock'];

function newFileName () {
  var d = new Date();
  var mm = d.getMonth() + 1; // getMonth() is zero-based
  var dd = d.getDate();

  return [
    d.getFullYear(),
    '-',
    (mm > 9 ? '' : '0') + mm,
    '-',
    (dd > 9 ? '' : '0') + dd,
    ' - ',
    status.nMssn,
    '-',
    status.sub,
    '.log'
  ].join('');
}

function newLogFile (cleanMissionStatus) {
  try {
    if (!status.lastCycle) status.lastCycle = cleanMissionStatus.cycle;
    if (!status.nMssn) status.nMssn = cleanMissionStatus.nMssn;
    if (!status.sub) status.sub = 0;

    if (noneStatus.indexOf(status.lastCycle) >= 0 && noneStatus.indexOf(cleanMissionStatus.cycle) < 0) {
      // change mission when cycle from none or dock to a different cycle

      if (status.nMssn < cleanMissionStatus.nMssn) {
        status.nMssn = cleanMissionStatus.nMssn;
        status.sub = 1;
      } else if (status.nMssn === cleanMissionStatus.nMssn) {
        status.nMssn = cleanMissionStatus.nMssn + 1;
        status.sub = 1;
      } else {
        status.sub++;
      }

      status.missionFile = newFileName();

      console.log('Current mission file: ' + status.missionFile);
      myRobot.emit('update', {'action': 'clear'});
    } else if (!status.missionFile) {
      if (!status.sub) status.sub = 1;
      status.missionFile = newFileName();
      console.log('Current mission file: ' + status.missionFile);
    }

    status.lastCycle = cleanMissionStatus.cycle;
    jsonfile.writeFile(statusPath, status, {spaces: 2});
  } catch (e) {
    console.log(e);
    console.log(e.stack);
  }
  return status.missionFile;
}

function logUpdate (msg) {
  try {
    if (msg && msg.state && msg.state.reported && (msg.state.reported.pose || msg.state.reported.cleanMissionStatus || msg.state.reported.batPct || msg.state.reported.bin)) {
      msg.state.reported.timestamp = new Date();

      if (msg.state.reported.cleanMissionStatus) {
        console.log(JSON.stringify(msg.state.reported.cleanMissionStatus));
        newLogFile(msg.state.reported.cleanMissionStatus);
      }

      if (status.missionFile) {
        var filename = path.join(missionsPath, status.missionFile);
        fs.appendFile(filename, JSON.stringify(msg.state.reported) + '\n', { mode: 0o664 }, function (err) {
          if (err) throw err;
        });
      }
      myRobot.emit('update', msg.state.reported);
    }
  } catch (e) {
    console.log(e);
    console.log(e.stack);
  }
}

function connect () {
  handleIP(function (e, ip) {
    if (e) throw e;
    myRobot.knownIP = ip;
    if (enableLocal === 'yes') {
      if (firmwareVersion === 1 || (keepAlive === 'yes')) {
        myRobot.local = new dorita980.Local(blid, password, ip, firmwareVersion);

        myRobot.local.on('update', logUpdate);

        myRobot.local.on('connect', function () {
          console.log('Robot connected');
        });

        myRobot.local.on('close', function (err) {
          console.log('Robot connection closed: ' + err);
          if (err) console.log(err.stack);
        });
      }
    }
    if (enableCloud === 'yes') myRobot.cloud = new dorita980.Cloud(blid, password, firmwareVersion);
  });
}

connect();

module.exports = myRobot;
