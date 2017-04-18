const onStartScanButton = require('./view/ui').onStartScanButton;
const onStopScanButton = require('./view/ui').onStopScanButton;
const initialize = require('./view/ui').initialize;
const phone = require('./view/phone');
const logger = require('./utility').logger;

const onDeviceReady = function() {
	logger("onDeviceReady() called");
  // Allow the app to work in background mode
  cordova.plugins.backgroundMode.enable();
	// Safe to use the buttons now
	window.onStartScanButton = onStartScanButton;
	window.onStopScanButton = onStopScanButton;
	initialize();
};

window.onload = function(){
	logger("onload() called")
	document.addEventListener('deviceready', onDeviceReady, false);
	phone.adjustLayout();
};