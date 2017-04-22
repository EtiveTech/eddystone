const onSaveButton = require('./view/ui').onSaveButton;
const initialize = require('./view/ui').initialize;
const logger = require('./utility').logger;

const onDeviceReady = function() {
	logger("onDeviceReady() called");
  // Allow the app to work in background mode
  cordova.plugins.backgroundMode.enable();
	// Safe to use the buttons now
	window.onSaveButton = onSaveButton;
	initialize();
};

window.onload = function(){
	logger("onload() called")
	document.addEventListener('deviceready', onDeviceReady, false);
};