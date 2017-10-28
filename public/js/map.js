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

var replaying=false;
var replayStep=0;

var webSocket;

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
  if (zoom>Math.min( sizeX/(maxX-minX), sizeY/(maxY-minY) ) || minX < -xOffset || minY < -yOffset || maxX > -xOffset + sizeX/zoom || maxY > -yOffset + sizeY/zoom) {
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

function loadCurrent() {
  return new Promise(function(resolve, reject) {
    console.log(new Date().toISOString()+" loading data");
    $.get('missions/current', function (data) {
        console.log(new Date().toISOString()+" processing data");
        var lines = data.split('\n');
        for(var i = 0;i < lines.length;i++){
          var l=lines[i];
          try {
            if (l.charAt(0) === '{') {
              var msg=JSON.parse(l);
              if (msg.pose) {
                updateMinMax(msg.pose.point.x, msg.pose.point.y);
                steps.push(msg.pose);
              }
            }
          } catch(e) {
            console.log(l);
            console.log(e);
          }
        }
        console.log(new Date().toISOString()+" processing complete");
        resolve();
    });
  });
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
  
  resizeCanvas();
  
  /*
  replaying=true;
  loadCurrent().then(
    startMissionLoop
  ).then(
    fit
  ); 
  */
  
  openWs(true);
}

function startMissionLoop () {
  if (mapping) {
    $('#mapStatus').html('getting point...');
    $.get('api/local/info/mission', function (data) {
      messageHandler(data);
    }).always(function () {
      setTimeout(startMissionLoop, updateEvery);
    });
  } else {
    $('#mapStatus').html('stopped');
  }
}

function messageHandler (msg) {
  // msg is the object returned by dorita980.getMission() promise.
  if (msg.cleanMissionStatus) {
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
    msg.ok.pos,
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

function drawStep (pose, phase) {
  x = pose.point.x;
  y = pose.point.y;
  theta = pose.theta;

  if (!replaying && (x!=lastX || y!=lastY || theta!=lastTheta)) {
    drawRobotBody(x, y, lastX, lastY, theta);
    lastTheta=theta;
  }

  if (x!=lastX || y!=lastY) {
    steps.push(pose);
    if (!replaying) drawSegment(x,y);
    lastX=x;
    lastY=y;
  }

  // draw changes in status with text.
  if (!replaying && phase !== lastPhase) {
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

function replay() {
  replaying=true;
  redraw();
}
function doReplay() {
  if (replayStep<steps.length) {
    for(var i=0; i<2 && i<steps.length-replayStep; i++) {
      var item=steps[replayStep+i];
      drawSegment(item.point.x, item.point.y);
    }
    replayStep+=i;
    setTimeout(doReplay,0);
  } else {
    replaying=false;

    if (phases.length>0) {
      var item=phases[phases.length - 1];
      drawPhase(item.x, item.y, item.phase);
    }
    
    drawRobotBody(lastX, lastY, lastX, lastY, lastTheta);
    console.log ('Replay completed '+steps.length+' steps');
  }
}
function redraw() {
    scaleAndTranslateCanvases();
    
    if (replaying) {
      console.log ('Replaying...');
      replayStep=0;
      setTimeout(doReplay,0);
    } else {
      console.log ('Redrawing...');
      steps.forEach(function(item, index) {
        drawSegment(item.point.x, item.point.y);
      });

      if (phases.length>0) {
        var item=phases[phases.length - 1];
        drawPhase(item.x, item.y, item.phase);
      }
      
      drawRobotBody(lastX, lastY, lastX, lastY, lastTheta);
      console.log ('Redraw completed '+steps.length+' steps');
    }
}

function clearMap () {
  lastPhase = '';
  phases=[];
  steps=[];
  minX=0;
  minY=0;
  maxX=0;
  maxY=0;

  fit();
}

function toggleMapping (start) {
  mapping = start;
//  if (mapping) startMissionLoop();
  if (mapping) {
    clearMap();
    openWs(true);
  }
  else closeWs();
  
  if (start) {
    $('#start').hide();
    $('#stop').show();
  } else {
    $('#start').show();
    $('#stop').hide();
  }
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

var lastRecPhase;

function handleEvent (msg) {
  var time = new Date().toISOString();
  $('#last').html(time);
  
  if (msg.maxX) {
    minX=msg.minX;
    minY=msg.minY;
    maxX=msg.maxX;
    maxY=msg.maxY;
    scale();
  }

  if (msg.cleanMissionStatus) {
    // {"cleanMissionStatus":{"cycle":"none","phase":"charge","expireM":0,"rechrgM":0,"error":0,"notReady":0,"mssnM":5,"sqft":20,"initiator":"manual","nMssn":41}}
    $('#cycle').html(msg.cleanMissionStatus.cycle);
    $('#phase').html(msg.cleanMissionStatus.phase);
    $('#expireM').html(msg.cleanMissionStatus.expireM);
    $('#rechrgM').html(msg.cleanMissionStatus.rechrgM);
    $('#error').html(msg.cleanMissionStatus.error);
    $('#notReady').html(msg.cleanMissionStatus.notReady);
    $('#mission').html(msg.cleanMissionStatus.mssnM);
    $('#sqft').html(msg.cleanMissionStatus.sqft);
    $('#nMssn').html(msg.cleanMissionStatus.nMssn);
    lastRecPhase=msg.cleanMissionStatus.phase;
  }

  if (msg.pose) {
    // {"pose":{"theta":-4,"point":{"x":36,"y":1}}}
    $('#theta').html(msg.pose.theta);
    $('#x').html(msg.pose.point.x);
    $('#y').html(msg.pose.point.y);

    drawStep(
      msg.pose,
      lastRecPhase
    );
  }
  
  if (msg.batPct) {
    // {"batPct":100}
    $('#batPct').html(msg.batPct);
  }
  
  if (msg.bin) {
    // {"bin":{"present":true,"full":false}}
    $('#bin').html(msg.bin.present);
    $('#full').html(msg.bin.full);
  }

  $('#steps').html(steps.length);
}

function closeWs() {
  if (!webSocket.closed) {
    webSocket.closed=true;
    webSocket.close();
  }
}

function openWs(load) {
    var uri = load ? 'loadandevents' : 'events';
    var l = window.document.location;
    
    var wsUrl = (l.protocol === 'https:' ? 'wss' : 'ws')+'://'+l.host+l.pathname+'/../missions/'+uri;
		webSocket = new WebSocket(wsUrl);
		
		webSocket.onclose = function(event) {
		  console.log('ws closed: code='+event.code);
		  if (!webSocket.closed) setTimeout( openWs, 1000);
		}

		webSocket.onerror = function(event) {
		  console.log('ws error: '+event);
		}
		
		webSocket.onopen = function(event) {
		  console.log('ws established');
      if (load) {
        replaying=true;
//        setTimeout( redraw, 1000 );
      } 
		}
		
		webSocket.onmessage = function (event) {
//		  console.log('ws: '+event.data);
//		  setTimeout( function() { handleEvent(JSON.parse(event.data)) }, 1);
		  handleEvent(JSON.parse(event.data));
		}
}
