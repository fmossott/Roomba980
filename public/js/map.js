/*  global $ alert WebSocket URL Blob */
/*  eslint no-unused-vars: "off" */
/*  eslint no-global-assign: "off" */
/*  eslint no-native-reassign: "off" */

function RoombaMap (headerSelector, changeListener) {
  var mapChangeStatus = changeListener;
  var header = headerSelector;

  var xOffset;
  var yOffset;
  var sizeX;
  var sizeY;

  var pathLayerContext;
  var robotBodyLayerContext;
  var textLayerContext;

  var pathLayer;
  var robotBodyLayer;
  var textLayer;

  var lastPhase = '';
  var mapping = true;

  var zoom;

  var minX;
  var minY;
  var maxX;
  var maxY;

  var lastX;
  var lastY;
  var lastTheta;

  var steps = [];
  var phases = [];

  var replaying = false;
  var replayStep = 0;

  var webSocket;

  function updateMinMax (x, y, autoScale) {
    var changed = false;

    if (!minX || x < minX) {
      minX = x;
      changed = true;
    }

    if (!minY || y < minY) {
      minY = y;
      changed = true;
    }

    if (!maxX || x > maxX) {
      maxX = x;
      changed = true;
    }

    if (!maxY || y > maxY) {
      maxY = y;
      changed = true;
    }

    if (autoScale && changed) scale();
  }

  function updateViewInfo () {
    if (mapChangeStatus && mapChangeStatus.updateViewInfo) {
      mapChangeStatus.updateViewInfo(zoom, xOffset, yOffset, sizeX, sizeY);
    }
  }

  function updateBin (present, full) {
    if (mapChangeStatus && mapChangeStatus.updateBin) {
      mapChangeStatus.updateBin(present, full);
    }
  }

  function updateMission (mission) {
    if (mapChangeStatus && mapChangeStatus.updateMission) {
      mapChangeStatus.updateMission(mission);
    }
  }

  function updateBatPct (bat) {
    if (mapChangeStatus && mapChangeStatus.updateBatPct) {
      mapChangeStatus.updateBatPct(bat);
    }
  }

  function updatePose (x, y, theta, numSteps, timestamp) {
    if (mapChangeStatus && mapChangeStatus.updatePose) {
      mapChangeStatus.updatePose(x, y, theta, numSteps, timestamp);
    }
  }

  function updateMapping (mapping) {
    if (mapChangeStatus && mapChangeStatus.updateMapping) {
      mapChangeStatus.updateMapping(mapping);
    }
  }

  function scale (forcePan) {
    var changed = false;
    var border = forcePan ? 50 : 200;
    // autozoom
    if (zoom > Math.min(sizeX / (maxX - minX), sizeY / (maxY - minY)) || minX < -xOffset || minY < -yOffset || maxX > -xOffset + sizeX / zoom || maxY > -yOffset + sizeY / zoom) {
      zoom = Math.min(sizeX / (maxX - minX + 200), sizeY / (maxY - minY + 200), 1);
      changed = true;
    }

    if (forcePan || changed || minX < -xOffset || minY < -yOffset || maxX > -xOffset + sizeX / zoom || maxY > -yOffset + sizeY / zoom) {
      xOffset = (-maxX - minX + sizeX / zoom) / 2;
      yOffset = (-maxY - minY + sizeY / zoom) / 2;
      if (!xOffset) xOffset = -sizeX / zoom / 2;
      if (!yOffset) yOffset = -sizeX / zoom / 2;
      changed = true;
    }

    if (changed) {
      console.log('Scaling to (' + (-xOffset) + ',' + (-yOffset) + ') -> (' + (-xOffset + sizeX / zoom) + ',' + (-yOffset + sizeY / zoom) + ')');
      redraw(true);
      updateViewInfo();
    }

    return changed;
  }

  function center () {
    scale(true);
  }

  function fit () {
    zoom = 1;
    scale(true);
  }

  $(window).resize(resizeCanvas);

  function resizeCanvas () {
    sizeX = $(headerSelector).width();
    sizeY = Math.max(100, Math.min(window.innerHeight, window.outerHeight) - $(headerSelector).height() - $(headerSelector).offset().top - ($(document.body).outerWidth(true) - $(document.body).width()));

    fit();
  }

  function scaleAndTranslateCanvases () {
    pathLayer.width = sizeX;
    pathLayer.height = sizeY;

    robotBodyLayer.width = sizeX;
    robotBodyLayer.height = sizeY;

    textLayer.width = sizeX;
    textLayer.height = sizeY;

    pathLayerContext.scale(zoom, zoom);
    robotBodyLayerContext.scale(zoom, zoom);
    textLayerContext.scale(zoom, zoom);

    pathLayerContext.translate(-xOffset, yOffset);
    robotBodyLayerContext.translate(-xOffset, yOffset);
    textLayerContext.translate(-xOffset, yOffset);

    pathLayerContext.beginPath();
  }

  function loadCurrent () {
    loadMap('missions/current');
  }

  function loadMap (url) {
    return new Promise(function (resolve, reject) {
      console.log(new Date().toISOString() + ' loading data');
      $.get(url, function (data) {
        console.log(new Date().toISOString() + ' processing data');
        var lines = data.split('\n');
        for (var i = 0; i < lines.length; i++) {
          var l = lines[i];
          try {
            if (l.charAt(0) === '{') {
              var msg = JSON.parse(l);
              if (msg.pose) {
                updateMinMax(msg.pose.point.x, msg.pose.point.y);
                steps.push(msg.pose);
              }
            }
          } catch (e) {
            console.log(l);
            console.log(e);
          }
        }
        console.log(new Date().toISOString() + ' processing complete');
        resolve();
      });
    });
  }

  function init () {
    pathLayer = document.getElementById('path_layer');
    robotBodyLayer = document.getElementById('robot_body_layer');
    textLayer = document.getElementById('text_layer');

    updateViewInfo();

    pathLayerContext = pathLayer.getContext('2d');
    robotBodyLayerContext = robotBodyLayer.getContext('2d');
    textLayerContext = textLayer.getContext('2d');

    pathLayerContext.beginPath();
    pathLayerContext.lineWidth = 1;
    pathLayerContext.strokeStyle = '#000000';
    pathLayerContext.lineCap = 'round';

    resizeCanvas();
  }

  function drawPhase (x, y, phase) {
    x = sizeX / zoom - x;
    textLayerContext.font = 'normal ' + (12 / zoom) + 'pt Calibri';
    textLayerContext.fillStyle = 'blue';
    textLayerContext.fillText(phase, x + calcRadio(), y);
  }

  function drawSegment (x, y, stroke) {
    x = sizeX / zoom - x;
    pathLayerContext.lineTo(x, y);
    if (stroke) {
      pathLayerContext.stroke();
    }
  }

  function drawStep (pose, phase) {
    var x = pose.point.x;
    var y = pose.point.y;
    var theta = pose.theta;

    if (!replaying && (x !== lastX || y !== lastY || theta !== lastTheta)) {
      drawRobotBody(x, y, lastX, lastY, theta);
      lastTheta = theta;
    }

    if (x !== lastX || y !== lastY) {
      steps.push(pose);
      if (!replaying) drawSegment(x, y, true);
      lastX = x;
      lastY = y;
    }

    // draw changes in status with text.
    if (!replaying && phase !== lastPhase) {
      phases.push({x, y, phase});
      drawPhase(x, y, phase);
      lastPhase = phase;
    }

    updateMinMax(x, y, true);
  }

  function calcRadio () {
    var radio = 15;
    if (radio * zoom < 5) radio = 5 / zoom;
    if (radio * zoom > 30) radio = 30 / zoom;

    return radio;
  }

  function drawRobotBody (x, y, prevX, prevY, theta) {
    x = sizeX / zoom - x;
    prevX = sizeX / zoom - prevX;

    theta = parseInt(theta, 10);
    var radio = calcRadio();

    var lineWidth = radio / 5;

    robotBodyLayerContext.clearRect(prevX - radio - 5, prevY - radio - 5, 2 * radio + 10, 2 * radio + 10);
    robotBodyLayerContext.beginPath();
    robotBodyLayerContext.arc(x, y, radio, 0, 2 * Math.PI, false);
    robotBodyLayerContext.fillStyle = 'green';
    robotBodyLayerContext.fill();
    robotBodyLayerContext.lineWidth = lineWidth;
    robotBodyLayerContext.strokeStyle = '#003300';
    robotBodyLayerContext.stroke();

    var outerX = x - radio * Math.cos((theta) * (Math.PI / 180));
    var outerY = y + radio * Math.sin((theta) * (Math.PI / 180));

    robotBodyLayerContext.beginPath();
    robotBodyLayerContext.moveTo(x, y);
    robotBodyLayerContext.lineTo(outerX, outerY);
    robotBodyLayerContext.strokeStyle = '#003300';
    robotBodyLayerContext.lineWidth = lineWidth;
    robotBodyLayerContext.stroke();
  }

  function replay () {
    replaying = true;
    redraw();
  }
  function doReplay () {
    if (replayStep < steps.length) {
      var stepsPerCycle = (replaying ? 2 : 500);
      for (var i = 0; i < stepsPerCycle && i < steps.length - replayStep; i++) {
        var step = steps[replayStep + i];
        drawSegment(step.point.x, step.point.y, false);
      }
      pathLayerContext.stroke();
      replayStep += i;
      setTimeout(doReplay, 0);
    } else {
      if (phases.length > 0) {
        var p = phases[phases.length - 1];
        drawPhase(p.x, p.y, p.phase);
      }

      drawRobotBody(lastX, lastY, lastX, lastY, lastTheta);
      console.log((replaying ? 'Replay' : 'Redraw') + ' completed ' + steps.length + ' steps');

      replaying = false;
    }
  }
  function redraw (now) {
    scaleAndTranslateCanvases();
    console.log(replaying ? 'Replaying...' : 'Redrawing...');
    replayStep = 0;
    if (now) {
      doReplay();
    } else {
      setTimeout(doReplay, 0);
    }
  }

  function clearMap () {
    lastPhase = '';
    phases = [];
    steps = [];
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;

    fit();
  }

  function toggleMapping (start) {
    mapping = start;
    if (mapping) {
      clearMap();
      reconnectWs(true);
    } else {
      reconnectWs(false, true);
      updateMission();
    }

    updateMapping(start);
  }

  function getValue (name, actual) {
    var newValue = parseInt($(name).val(), 10);
    if (isNaN(newValue)) {
      alert('Invalid ' + name);
      $(name).val(actual);
      return actual;
    }
    return newValue;
  }

  function getValueFloat (name, actual) {
    var newValue = parseFloat($(name).val());
    if (isNaN(newValue)) {
      alert('Invalid ' + name);
      $(name).val(actual);
      return actual;
    }
    return newValue;
  }

  function downloadCanvas () {
    var bodyCanvas = document.getElementById('robot_body_layer');
    var pathCanvas = document.getElementById('path_layer');

    var bodyContext = bodyCanvas.getContext('2d');
    bodyContext.drawImage(pathCanvas, 0, 0);

    document.getElementById('download').href = bodyCanvas.toDataURL();
    document.getElementById('download').download = 'current_map.png';
  }

  function downloadSteps () {
    var json = JSON.stringify(steps);
    var blob = new Blob([json], {type: 'application/json'});
    var url = URL.createObjectURL(blob);
    document.getElementById('downloadData').href = url;
    document.getElementById('downloadData').download = 'current_data.json';
  }

  function doAction (path, cb) {
    $.get(path, function (data) {
      if (cb) cb(data);
    });
  }

  var lastRecPhase;

  function handleEvent (msg) {
    if (msg.action === 'clear') {
      clearMap();
    }

    if (msg.maxX) {
      minX = msg.minX;
      minY = msg.minY;
      maxX = msg.maxX;
      maxY = msg.maxY;
      var rep = replaying;
      replaying = false;
      fit();
      replaying = rep;
    }

    if (msg.cleanMissionStatus) {
      // {"cleanMissionStatus":{"cycle":"none","phase":"charge","expireM":0,"rechrgM":0,"error":0,"notReady":0,"mssnM":5,"sqft":20,"initiator":"manual","nMssn":41}}
      lastRecPhase = msg.cleanMissionStatus.phase;

      updateMission(msg.cleanMissionStatus);
    }

    if (msg.pose && mapping) {
      // {"pose":{"theta":-4,"point":{"x":36,"y":1}}}
      updatePose(msg.pose.point.x, msg.pose.point.y, msg.pose.theta, steps.length, msg.timestamp);

      drawStep(
        msg.pose,
        lastRecPhase
      );
    }

    if (msg.batPct) {
      updateBatPct(msg.batPct);
    }

    if (msg.bin) {
      updateBin(msg.bin.present, msg.bin.full);
    }
  }

  function reconnectWs (load, statusOnly) {
    if (webSocket && !webSocket.closed) {
      webSocket.onclose = function (event) {
        console.log('ws closed: code=' + event.code);
        openWs(load, statusOnly);
      };

      webSocket.closed = true;
      webSocket.close();
    } else {
      openWs(load, statusOnly);
    }
  }

  function closeWs () {
    if (!webSocket.closed) {
      webSocket.closed = true;
      webSocket.close();
    }
  }

  function openWs (load, statusOnly) {
    var uri = statusOnly ? 'status' : load ? 'loadandevents' : 'events';
    var l = window.document.location;

    var wsUrl = (l.protocol === 'https:' ? 'wss' : 'ws') + '://' + l.host + l.pathname + '/../missions/' + uri;
    webSocket = new WebSocket(wsUrl);

    webSocket.onclose = function (event) {
      console.log('ws closed: code=' + event.code);
      if (mapChangeStatus && mapChangeStatus.disconnected) mapChangeStatus.disconnected();
      if (!webSocket.closed) {
        setTimeout(function () {
          openWs(false, statusOnly);
        }, 1000);
      }
    };

    webSocket.onerror = function (event) {
      console.log('ws error: ' + event);
    };

    webSocket.onopen = function (event) {
      console.log('ws established for ' + uri);
      if (load && !statusOnly) {
        replaying = true;
        setTimeout(redraw, 1000);
      }
    };

    webSocket.onmessage = function (event) {
      handleEvent(JSON.parse(event.data));
    };
  }

  function mapSelected (map) {
    toggleMapping(false);
    if (map.name === 'current') {
      toggleMapping(true);
    } else {
      clearMap();
      setTimeout(function () {
        replaying = true;
        loadMap(map.url).then(fit);
      }, 10);
    }
  }

  function loadMissions (cb) {
    $.get('missions', cb);
  }

  this.mapSelected = mapSelected;
  this.toggleMapping = toggleMapping;
  this.loadMissions = loadMissions;
  this.doAction = doAction;
  this.downloadCanvas = downloadCanvas;
  this.clearMap = clearMap;
  this.replay = replay;
  this.init = init;
  this.center = center;
  this.fit = fit;
}

