'use strict'

const Repository = require('./network/repository');
const UI = require('./view/ui');
const dispatcher = require('./network/api_request_dispatcher');
const logger = require('./logger');
// const baseURL = "https://c4a.etive.org:8443/api";
const baseURL = "http://c4a.etive.org:8080/api";
const logToConsole = true;
const logToFile = false;

const onDeviceReady = function() {
  // Allow the app to work in background mode
  cordova.plugins.backgroundMode.enable();
  // Allow the app to start automatically at boot time
  cordova.plugins.autoStart.enable();
  // Initialise the logger
  logger.initialise({file: logToFile, console: logToConsole}, function() {
  	dispatcher.setSystemDispatcher(baseURL);
    const ui = new UI(new Repository(baseURL));
  });
};

window.onload = function(){
	document.addEventListener('deviceready', onDeviceReady, false);
};