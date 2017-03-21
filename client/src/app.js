const onStartScanButton = require('./view/ui').onStartScanButton;
const onStopScanButton = require('./view/ui').onStopScanButton;
const phone = require('./view/phone');
const logger = require('./utility').logger;

const onDeviceReady = function() {
	logger("onDeviceReady() called");
	// Safe to use the buttons now
	window.onStartScanButton = onStartScanButton;
	window.onStopScanButton = onStopScanButton;
};

window.onload = function(){
	logger("onload() called")
	document.addEventListener('deviceready', onDeviceReady, false);
	phone.adjustLayout();
};