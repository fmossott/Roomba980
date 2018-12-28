/*  global $ RoombaMap */
/*  eslint no-unused-vars: "off" */
/*  eslint no-global-assign: "off" */
/*  eslint no-native-reassign: "off" */

$.fn.dataTable.ext.errMode = 'throw';
var mapTable = $('#maps_table').DataTable({
  'columns': [
    { data: 'name' },
    { data: 'steps' }
  ],
  'order': [
    [0, 'desc']
  ]
});

$('#maps_table tbody').on('click', 'tr', function () {
  if ($(this).hasClass('selected')) {
    $(this).removeClass('selected');
    $('#ok_map_table').prop('disabled', true);
  } else {
    mapTable.$('tr.selected').removeClass('selected');
    $(this).addClass('selected');
    $('#ok_map_table').prop('disabled', false);
  }
});

$('#maps_table tbody').on('dblclick', 'tr', function () {
  $('#selectMapModal').modal('hide');
  roombaMap.mapSelected(mapTable.row(this).data());
});

$('#ok_map_table').click(function () {
  var r = mapTable.row('.selected');
  if (r) {
    var d = r.data();
    $('#map_name').html(d.name);
    roombaMap.mapSelected(d);
  }
});

function loadMapList () {
  $('#ok_map_table').prop('disabled', true);
  $('#maps_table .selected').removeClass('selected');

  mapTable.clear();
  mapTable.draw();

  roombaMap.loadMissions(function (data) {
    var maps = data;

    maps.forEach((map) => {
      mapTable.row.add({ id: map.name, url: map.url, name: map.name, steps: map.steps });
    });

    mapTable.draw();
  });
}

$('.action').on('click', function () {
  var me = $(this);
  var path = me.data('action');
  if (me.button) me.button('loading');
  roombaMap.doAction(path, function (data) {
    if (me.button) me.button('reset');
    $('#apiresponse').html(JSON.stringify(data));
  });
});

var mapChangeStatus = {
  updateMission: function (mission) {
    $('#cycle').html(mission ? mission.cycle : '');
    $('#phase').html(mission ? mission.phase : '');
    $('#expireM').html(mission ? mission.expireM : '');
    $('#rechrgM').html(mission ? mission.rechrgM : '');
    $('#error').html(mission ? mission.error : '');
    $('#notReady').html(mission ? mission.notReady : '');
    $('#mission').html(mission ? mission.mssnM : '');
    $('#sqft').html(mission ? mission.sqft : '');
    $('#nMssn').html(mission ? mission.nMssn : '');
    $('#mapStatus').html('');
  },

  updateViewInfo: function (zoom, xOffset, yOffset, sizeX, sizeY) {
    $('#zoom').html(zoom);
    $('#offsetx').val(xOffset);
    $('#offsety').val(yOffset);
    $('#sizew').val(sizeX);
    $('#sizeh').val(sizeY);
  },

  disconnected: function () {
    $('#mapStatus').html('!!! Disconnected !!!');
  },

  updatePose: function (x, y, theta, numSteps, timestamp) {
    $('#theta').html(theta);
    $('#x').html(x);
    $('#y').html(y);
    $('#steps').html(numSteps);
    $('#last').html(timestamp);
  },

  updateBatPct: function (bat) {
    $('#batPct').html();
  },

  updateBin: function (present, full) {
    $('#bin').html(present);
    $('#full').html(full);
  },

  updateMapping: function (mapping) {
    $('#menu-start-mapping').toggle(!mapping);
    $('#menu-stop-mapping').toggle(mapping);
  }
};

$('#menu-center').click(function () {
  roombaMap.center();
  return false;
});

$('#menu-fit').click(function () {
  roombaMap.fit();
  return false;
});

$('#menu-download').click(function () {
  roombaMap.downloadCanvas();
});

$('#menu-select-map').click(function () {
  loadMapList();
});

$('#menu-clear-map').click(function () {
  roombaMap.clearMap();
  return false;
});

$('#menu-replay').click(function () {
  roombaMap.replay();
  return false;
});

$('#menu-start-mapping').click(function () {
  roombaMap.toggleMapping(true);
  return false;
});

$('#menu-stop-mapping').click(function () {
  roombaMap.toggleMapping(false);
  return false;
});

var roombaMap = new RoombaMap('#header', mapChangeStatus);

window.onload = function () {
  roombaMap.init();
  $('#map_name').html('current');
  roombaMap.toggleMapping(true);
};
