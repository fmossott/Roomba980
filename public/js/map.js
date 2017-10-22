/*  global $ alert sizeX sizeY xOffset yOffset updateEvery */
/*  eslint no-unused-vars: "off" */
/*  eslint no-global-assign: "off" */
/*  eslint no-native-reassign: "off" */

window.onload = startApp;

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

var steps=[];
var phases=[];

function updateMinMax(x,y, autoScale) {
  var changed=false;

  if (!minX || x<minX) {
    minX=x;
    changed=true;
  }

  if (!minY || y<minY) {
    minY=y;
    changed=true;
  }

  if (!maxX || x>maxX) {
    maxX=x;
    changed=true;
  }

  if (!maxY || y>maxY) {
    maxY=y;
    changed=true;
  }
  
  if (autoScale && changed) scale();
}

function scale(forcePan) {  
  var changed = false;
  // autozoom
  if (zoom>Math.min( sizeX/(maxX-minX), sizeY/(maxY-minY) )) {
    zoom=Math.min( sizeX/(maxX-minX+200), sizeY/(maxY-minY+200));
    $('#zoom').val(zoom);
    changed = true;
  }
  
  if (forcePan || changed || minX < -xOffset || minY < -yOffset || maxX > -xOffset + sizeX/zoom || maxY > -yOffset + sizeY/zoom) {
    xOffset = (-maxX - minX + sizeX/zoom) / 2;
    yOffset = (-maxY - minY + sizeY/zoom) / 2;
    $('#offsetx').val(xOffset);
    $('#offsety').val(yOffset);
    changed=true;
  }
  
  if (changed) redraw();
  
  return changed;
}

function center() {
  scale(true);
}

function fit() {
  zoom=1;
  $('#zoom').val(zoom);
  scale(true);
}

$(window).resize(resizeCanvas);

function resizeCanvas() {
//  sizeX=window.innerWidth;
  sizeX=$("#map").width();
  sizeY=window.innerHeight-$("#menu").height()-20;

  $('#sizew').val(sizeX);
  $('#sizeh').val(sizeY);

  fit();
}

function scaleAndTranslateCanvases() {
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

function startApp () {
  pathLayer = document.getElementById('path_layer');
  robotBodyLayer = document.getElementById('robot_body_layer');
  textLayer = document.getElementById('text_layer');

  $('#sizew').val(sizeX);
  $('#sizeh').val(sizeY);

  $('#offsetx').val(xOffset);
  $('#offsety').val(yOffset);

  $('#updateevery').val(updateEvery);

  pathLayerContext = pathLayer.getContext('2d');
  robotBodyLayerContext = robotBodyLayer.getContext('2d');
  textLayerContext = textLayer.getContext('2d');

  pathLayerContext.beginPath();
  pathLayerContext.lineWidth = 1;
  pathLayerContext.strokeStyle = '#000000';
  pathLayerContext.lineCap = 'round';
  
  if (steps.length>0) {
    steps.forEach(function(item, index) {
      updateMinMax(item.x, item.y);
    });
  } else {
    minX=0; maxX=0; minY=0; maxY=0;
  }
  resizeCanvas();

  startMissionLoop();
}

function startMissionLoop () {
  if (mapping) {
    $('#mapStatus').html('getting point...');
    $.get('/api/local/info/mission', function (data) {
      messageHandler(data);
      setTimeout(startMissionLoop, updateEvery);
    });
  } else {
    $('#mapStatus').html('stopped');
  }
}

function messageHandler (msg) {
  // msg is the object returned by dorita980.getMission() promise.
  if (msg.cleanMissionStatus) {
    // firmware version 2
    msg.ok = msg.cleanMissionStatus;
    msg.ok.pos = msg.pose;
    msg.ok.batPct = msg.batPct;
    $('#bin').html(msg.bin.present);
    $('#nMssn').html(msg.ok.nMssn);
  }
  msg.ok.time = new Date().toISOString();
  $('#mapStatus').html('drawing...');
  $('#last').html(msg.ok.time);
  $('#mission').html(msg.ok.mssnM);
  $('#cycle').html(msg.ok.cycle);
  $('#phase').html(msg.ok.phase);
  $('#flags').html(msg.ok.flags);
  $('#batPct').html(msg.ok.batPct);
  $('#error').html(msg.ok.error);
  $('#sqft').html(msg.ok.sqft);
  $('#expireM').html(msg.ok.expireM);
  $('#rechrgM').html(msg.ok.rechrgM);
  $('#notReady').html(msg.ok.notReady);
  $('#theta').html(msg.ok.pos.theta);
  $('#x').html(msg.ok.pos.point.x);
  $('#y').html(msg.ok.pos.point.y);

  drawStep(
    msg.ok.pos.point.x,
    msg.ok.pos.point.y,
    msg.ok.pos.theta,
    msg.ok.cycle,
    msg.ok.phase
  );
  $('#steps').html(steps.length);
  $('#mapStatus').html('');
}

function drawPhase(x,y,phase) {
  x=sizeX/zoom-x;
  textLayerContext.font = 'normal '+(12/zoom)+'pt Calibri';
  textLayerContext.fillStyle = 'blue';
  textLayerContext.fillText(phase, x+calcRadio(), y);
}

function drawSegment(x, y) {
  x=sizeX/zoom-x;
  pathLayerContext.lineTo(x, y);
  pathLayerContext.stroke();
}

function drawStep (x, y, theta, cycle, phase) {
  if (phase === 'charge') {
    // hack (getMission() dont send x,y if phase is diferent as run)
    x = 0;
    y = 0;
  }

  x = parseInt(x, 10);
  y = parseInt(y, 10);

  if (x!=lastX || y!=lastY || theta!=lastTheta) {
    drawRobotBody(x, y, lastX, lastY, theta);
    lastTheta=theta;
  }

  if (x!=lastX || y!=lastY) {
    steps.push({x,y});
    drawSegment(x,y);
    lastX=x;
    lastY=y;
  }

  // draw changes in status with text.
  if (phase !== lastPhase) {
    phases.push({x,y,phase});
    drawPhase(x,y,phase);
    lastPhase = phase;
  } 

  updateMinMax(x,y,true);
  
}

function calcRadio() {
  var radio = 15;
  if (radio*zoom < 5) radio=5/zoom;
  if (radio*zoom > 30) radio=30/zoom;
  
  return radio;
}

function drawRobotBody (x, y, prevX, prevY, theta) {
  x=sizeX/zoom-x;
  prevX=sizeX/zoom-prevX;
  
  theta = parseInt(theta, 10);
  var radio = calcRadio();
  
  var lineWidth = radio/5;
  
  robotBodyLayerContext.clearRect(prevX-radio-5, prevY-radio-5, 2*radio+10, 2*+radio+10);
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

function redraw() {
    scaleAndTranslateCanvases();
    
    steps.forEach(function(item, index) {
      drawSegment(item.x, item.y);
    });

    phases.forEach(function(item, index) {
      drawPhase(item.x, item.y, item.phase);
    });
    
    drawRobotBody(lastX, lastY, lastX, lastY, lastTheta);
}

function clearMap () {
  lastPhase = '';
  phases=[];
  steps=[];
  fit();
}

function toggleMapping () {
  mapping = !mapping;
  if (mapping) startMissionLoop();
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
  var blob = new Blob([json], {type: "application/json"});
  var url  = URL.createObjectURL(blob);
  document.getElementById('downloadData').href = url;
  document.getElementById('downloadData').download = 'current_data.json';
}

function saveValues () {
  var values = {
    'pointIntervalMs': updateEvery,
  };
  $.post('/map/values', values, function (data) {
  });
}

/* $('.metrics').on('change', function () {
  var toRedraw=false;
  
  var z = getValueFloat('#zoom', zoom);
  if (zoom != z) {
    zoom=z
    toRedraw=true;
  }
  
  var w = getValue('#sizew', pathLayer.width);
  if (sizeX != w) {
    sizeX=w;
    toRedraw=true;
  }

  var h = getValue('#sizeh', pathLayer.height);
  if (sizeY != h) {
    sizeY=h;
    toRedraw=true;
  }

  var newYOffset = getValue('#offsety', yOffset);
  if (newYOffset !== yOffset) {
    yOffset = newYOffset;
    toRedraw=true;
  }
  var newXOffset = getValue('#offsetx', xOffset);
  if (newXOffset !== xOffset) {
    xOffset = newXOffset;
    toRedraw=true;
  }
  
  if (toRedraw) fit();  
}); */

$('.action').on('click', function () {
  var me = $(this);
  var path = me.data('action');
  me.button('loading');
  $.get(path, function (data) {
    me.button('reset');
    $('#apiresponse').html(JSON.stringify(data));
  });
});

$('#updateevery').on('change', function () {
  updateEvery = getValue('#updateevery', updateEvery);
});

