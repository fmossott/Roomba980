const express = require('express');
const router = express.Router();

const client = require('prom-client');
const prefix = 'roomba_';
client.collectDefaultMetrics();
const batPctGauge = new client.Gauge({ name: prefix + 'battery', help: 'Roomba battery charge percentage: 0-100' });
const chargingGauge = new client.Gauge({ name: prefix + 'charging', help: 'Roomba battery is charging: 0/1' });
const activeChargingGauge = new client.Gauge({ name: prefix + 'active_charging', help: 'Roomba battery is activily charging (charging and the battery is less than 100%): 0/1' });
const hasMissionGauge = new client.Gauge({ name: prefix + 'has_mission', help: 'Roomba has a mission: 0/1' });
const cleaningGauge = new client.Gauge({ name: prefix + 'cleaning', help: 'Roomba is cleaning: 0/1' });

let lastBatPct = 0;
let lastCharging = 0;

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
    lastBatPct = msg.batPct;
    batPctGauge.set(msg.batPct);
    console.log('metrics.js - set battery: ' + msg.batPct);
  }

  if (msg.cleanMissionStatus) {
    const phase = msg.cleanMissionStatus.phase;
    const cycle = msg.cleanMissionStatus.cycle;

    // Check mission
    const hasMission = (cycle !== 'none' && cycle !== 'dock' ? 1 : 0);
    hasMissionGauge.set(hasMission);
    console.log('metrics.js - set has_mission: ' + hasMission);

    // Check cleaning
    const cleaning = (cycle !== 'none' && cycle !== 'dock' && phase !== 'stop' ? 1 : 0);
    cleaningGauge.set(cleaning);
    console.log('metrics.js - set cleaning: ' + cleaning);

    // Check charging
    lastCharging = (phase === 'charge' ? 1 : 0);
    chargingGauge.set(lastCharging);
    console.log('metrics.js - set charging: ' + lastCharging);
  }

  const activeCharging = (lastCharging === 1 && lastBatPct < 100) ? 1 : 0;
  activeChargingGauge.set(activeCharging);
  console.log('metrics.js - set active_charging: ' + activeCharging);
}

module.exports = (robot) => {
  myRobot = robot;
  myRobot.on('update', onUpdate);

  return router;
};
