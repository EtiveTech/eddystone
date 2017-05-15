const onSaveButton = require('./view/ui').onSaveButton;
const initialize = require('./view/ui').initialize;

const onDeviceReady = function() {
  // Allow the app to work in background mode
  cordova.plugins.backgroundMode.enable();
  // Allow the app to start automatically at boot time
  cordova.plugins.autoStart.enable();
	// Safe to use the buttons now
	window.onSaveButton = onSaveButton;
	initialize();
};

window.onload = function(){
	document.addEventListener('deviceready', onDeviceReady, false);
};