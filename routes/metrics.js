const express = require('express');
const router = express.Router();

const client = require('prom-client');
const prefix = 'roomba_';
client.collectDefaultMetrics();
const batPctGauge = new client.Gauge({ name: prefix + 'battery', help: 'Roomba battery charge percentage 0-100' });
const chargingGauge = new client.Gauge({ name: prefix + 'charging', help: 'Roomba battery is charging 0/1' });
const hasMissionGauge = new client.Gauge({ name: prefix + 'has_mission', help: 'Roomba has a mission 0/1' });
const lastMissionDurationGauge = new client.Gauge({ name: prefix + 'last_mission_duration', help: 'Duration of the last completed Roomba mission in seconds' });

let prevHasMission = -1;
let missionStart;

router.get('/', async (_req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

let myRobot;

function onUpdate (msg) {
  console.log('metrics.js - received msg: ' + JSON.stringify(msg));
  if (msg.batPct) {
    batPctGauge.set(msg.batPct);
    console.log('metrics.js - set batPctGauge: ' + msg.batPct);
  }

  if (msg.cleanMissionStatus) {
    const phase = msg.cleanMissionStatus.phase;
    const cycle = msg.cleanMissionStatus.cycle;

    // Check mission
    const hasMission = (cycle !== 'none' && cycle !== 'dock' ? 1 : 0);
    hasMissionGauge.set(hasMission);
    console.log('metrics.js - set hasMissionGauge: ' + hasMission);

    if (prevHasMission !== -1) {
      if (!prevHasMission && hasMission) {
        // was stop and now has started
        missionStart = Date.now();
        console.log('metrics.js - Mission started at ' + new Date(missionStart));
      } else if (prevHasMission && !hasMission) {
        // was running and now has stopped
        const missionEnd = Date.now();
        console.log('metrics.js - Mission stopped at ' + new Date(missionEnd));
        const duration = Math.floor((missionEnd - missionStart) / 1000);
        console.log('metrics.js - Mission duration ' + duration);
        lastMissionDurationGauge.set(duration);
      }
    }
    prevHasMission = hasMission;

    // Check charging
    const charging = (phase === 'charge' ? 1 : 0);
    chargingGauge.set(charging);
    console.log('metrics.js - set chargingGauge: ' + charging);
  }
}

module.exports = (robot) => {
  myRobot = robot;
  myRobot.on('update', onUpdate);

  return router;
};
