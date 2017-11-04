/*  global $ mdc history RoombaMap */
/*  eslint no-unused-vars: "off" */
/*  eslint no-global-assign: "off" */
/*  eslint no-native-reassign: "off" */

// Drawer
var drawerEl = document.querySelector('.mdc-temporary-drawer');
var MDCTemporaryDrawer = mdc.drawer.MDCTemporaryDrawer;
var drawer = new MDCTemporaryDrawer(drawerEl);

drawerEl.addEventListener('MDCTemporaryDrawer:open', function () {
  console.log('Received MDCTemporaryDrawer:open');
});

drawerEl.addEventListener('MDCTemporaryDrawer:close', function () {
  console.log('Received MDCTemporaryDrawer:close');
});

$('.map-menu').click(() => {
  drawer.open = true;
  return false;
});

// Navigation
$('.map-back').click(() => {
  history.back();
  return false;
});

function showHome () {
  $('.map-home-page').show();
  $('.map-sub-page').hide();
  $('.map-home-header').show();
  $('.map-sub-header').hide();
  mainFabPath = null;
}

function openSubMap (title) {
  drawer.open = false;
  $('.map-sub-title').html(title);
  $('.map-sub-page').hide();
  $('.map-home-page').show();
  $('.map-home-header').hide();
  $('.map-sub-header').show();
  mapChangeStatus.phase();
}

function openSub (subSel, title) {
  drawer.open = false;
  $('.map-sub-title').html(title);
  $('.map-home-page').hide();
  $(subSel).show();
  $('.map-home-header').hide();
  $('.map-sub-header').show();
  mapChangeStatus.phase();
}

// Hide at startup
$('.map-sub-page').hide();
$('.map-sub-header').hide();

// Drawer actions
$('#menu-select-map').click(function () {
  drawer.open = false;
  loadMapList();
  return false;
});

$('#menu-clear-map').click(function () {
  drawer.open = false;
  roombaMap.clearMap();
  return false;
});

$('#menu-replay').click(function () {
  drawer.open = false;
  roombaMap.replay();
  return false;
});

$('#start').click(function () {
  drawer.open = false;
  roombaMap.toggleMapping(true);
  return false;
});

$('#stop').click(function () {
  drawer.open = false;
  roombaMap.toggleMapping(false);
  return false;
});

$('#menu-select-map').click(function () {
  drawer.open = false;
  roombaMap.downloadCanvas();
  return false;
});

// FAB & Toolbar icons

var mainFabPath;

$('.map-main-fab').click(function () {
  if (mainFabPath) roombaMap.doAction(mainFabPath, showResult);
  return false;
});

$('#sec-fab-stop').click(function () {
  roombaMap.doAction('api/local/action/stop', showResult);
  return false;
});

$('#sec-fab-dock').click(function () {
  roombaMap.doAction('api/local/action/dock', showResult);
  return false;
});

var snackbar = new mdc.snackbar.MDCSnackbar($('#map-snackbar')[0]);

function showResult (res) {
  snackbar.dismissesOnAction = true;

  var data = {
    timeout: 1000,
    message: '???'
  };

  if (typeof res.ok !== 'undefined') {
    data.message = 'OK';
  } else if (typeof res.message !== 'undefined') {
    data.message = res.message;
    console.log(JSON.stringify(res));
  }

  snackbar.show(data);
}

var mapChangeStatus = {
  updateMission: function (mission) {
    var phase = mission.phase;
    var cycle = mission.cycle;
    if (phase) {
      $('#map_icon_warning').addClass('map-hidden');

      // Main FAB:
      if (['run', 'hmMidMsn', 'hmPostMsn', 'hmUsrDock'].indexOf(phase) > -1) {
        // Main FAB is Pause
        mainFabPath = 'api/local/action/pause';
        $('#main-fab-play').addClass('mdc-fab--exited');
        $('#main-fab-pause').removeClass('mdc-fab--exited');
      } else {
        if (cycle === 'none') {
          // Main FAB is Start
          console.log('Main FAB is Start');
          mainFabPath = 'api/local/action/start';
        } else {
          // Main FAB is Resume
          console.log('Main FAB is Resume');
          mainFabPath = 'api/local/action/resume';
        }
        $('#main-fab-pause').addClass('mdc-fab--exited');
        $('#main-fab-play').removeClass('mdc-fab--exited');
      }

      // Dock FAB if phase is not hmMidMsn, hmPostMsn, hmUsrDock, charge
      var dockEnabled = (['charge', 'hmMidMsn', 'hmPostMsn', 'hmUsrDock'].indexOf(phase) <= -1);
      $('#sec-fab-dock').toggleClass('mdc-fab--exited', !dockEnabled);
      $('#map_icon_dock').toggleClass('map-hidden', dockEnabled);

      // Stop FAB is cycle is not none
      var hasMission = (cycle !== 'none');
      $('#sec-fab-stop').toggleClass('mdc-fab--exited', !hasMission);
      $('#map_icon_mission').toggleClass('map-hidden', !hasMission);

      var charging = (phase === 'charge');
      $('#map_icon_battery_charging').toggleClass('map-hidden', !charging);
      $('#map_icon_battery_std').toggleClass('map-hidden', charging);
    }
  },

  updateBatPct: function (bat) {
    $('#map_icon_battery').removeClass('map-hidden');
    $('#map_icon_battery_qty').text(bat);
  },

  updateBin: function (present, full) {
    $('#map_icon_binfull').toggleClass('map-hidden', !full);
    $('#map_icon_binmissing').toggleClass('map-hidden', present);
  },

  updateMapping: function (mapping) {
    $('#menu-start-mapping').toggleClass('map-hidden', mapping);
    $('#menu-stop-mapping').toggleClass('map-hidden', !mapping);
  },

  disconnected: function (present, full) {
    $('.mdc-fab').addClass('mdc-fab--exited');
    $('.mdc-toolbar__icon').addClass('map-hidden');
    $('#map_icon_warning').removeClass('map-hidden');
  }
};

// Map Selection
function loadMapList () {
  var list = $('#map_selection_list');
  list.html('');

  roombaMap.loadMissions(function (data) {
    var maps = data.sort().reverse();

    maps.forEach((map) => {
      if (map.name !== 'current') {
        var li = $('<a>').attr('href', '#').addClass('mdc-list-item')
          .append($('<i>').addClass('mdc-list-item__start-detail material-icons').attr('aria-hidden', 'true').html('map'))
          .append($('<span>').addClass('mdc-list-item__text').attr('aria-hidden', 'true').html(map.name)
            .append($('<span>').addClass('mdc-list-item__text__secondary').html(map.steps + ' steps'))
          );

        li.data('map', map);
        list.append(li);
      }
    });
  });

  openSub('#maplist', 'Map Selection');
}

$('#map_selection_list').on('click', '.mdc-list-item', function () {
  var ripple = new mdc.ripple.MDCRipple(this);
  ripple.activate();

  var map = $(this).data('map');

  history.pushState(map, map.name);

  setTimeout(function () { openMap(map); }, 100);
  return false;
});

function openMap (map) {
  openSubMap('Roomba Map: ' + map.name);
  roombaMap.mapSelected(map);
}

// History

var currentState = history.state;

function posState (event) {
  console.log('location: ' + document.location + ', state: ' + JSON.stringify(event.state));
  if (event.state) {
    openMap(event.state);
  } else {
    roombaMap.toggleMapping(true);
    showHome();
  }
}

var roombaMap = new RoombaMap('#header', mapChangeStatus);

window.onpopstate = posState;

window.onload = function () {
  roombaMap.init();
  posState({ state: currentState });
};

mdc.autoInit();

