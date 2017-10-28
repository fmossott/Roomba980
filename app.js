var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var basicAuth = require('basic-auth');
var config = require('config');

var robot = require('./lib/robot');

var helloRoute = require('./routes/index');
var apiRoute = require('./routes/api')(robot);
var bmapRoute = require('./routes/bmap');
var mmapRoute = require('./routes/mmap');
var missionsRoute = require('./routes/missions')(robot);

var rootPath = process.env.ROOT_PATH || config.rootPath || '';

var app = express();

// Authentication handler
var basicAuthUser = process.env.BASIC_AUTH_USER || config.basicAuthUser;
var basicAuthPass = process.env.BASIC_AUTH_PASS || config.basicAuthPass;
var publicRoutes = [];

var authHandler = function (req, res, next) {
  // Allow if basic auth is not enabled
  if (!basicAuthUser || !basicAuthPass) return next();

  // Allow whitelisted public routes
  if (publicRoutes.indexOf(req.path) > -1) return next();

  function unauthorized (res) {
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.sendStatus(401);
  }

  // Get basis auth credentials
  var user = basicAuth(req);
  if (!user || !user.name || !user.pass) {
    return unauthorized(res);
  }

  // Check credentials
  if (user.name === basicAuthUser && user.pass === basicAuthPass) {
    return next();
  } else {
    return unauthorized(res);
  }
};

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(rootPath, express.static(path.join(__dirname, 'public')));
app.use(rootPath + '/material-components-web/dist', express.static(path.join(__dirname, 'node_modules/material-components-web/dist')));
app.use(authHandler);

app.use(rootPath + '/', helloRoute);
app.use(rootPath + '/api', apiRoute);
app.use(rootPath + '/bmap', bmapRoute);
app.use(rootPath + '/map', mmapRoute);
app.use(rootPath + '/missions', missionsRoute);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Endpoint not found.');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function (err, req, res) {
    res.status(err.status || 500);
    res.send({
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res) {
  res.status(err.status || 500);
  res.send({
    message: err.message,
    error: {}
  });
});

module.exports = app;
