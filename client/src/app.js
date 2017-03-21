"use strict"

const os = require('./os').os;
const applyiOS7LayoutHack = require('./os').applyiOS7LayoutHack;
const logger = require('./utility').logger;

// JavaScript code for the BLE Scan example app.

// Application object.
let app = {};

// Device list.
app.devices = {};

// UI methods.
app.ui = {};

// Timer that updates the device list and removes inactive
// devices in case no devices are found by scan.
app.ui.updateTimer = null;


app.onDeviceReady = function() {
	logger("onDeviceReady() called");
	window.app = app;
};

// Start the scan. Call the callback function when a device is found.
// Format:
//   callbackFun(deviceInfo, errorCode)
//   deviceInfo: address, rssi, name
//   errorCode: String
app.startScan = function(callbackFun) {
	app.stopScan();
	logger("Starting the scan");

	evothings.ble.startScan(
		function(device)
		{
			// Report success. Sometimes an RSSI of +127 is reported.
			// We filter out these values here.
			if (device.rssi <= 0)
			{
				callbackFun(device, null);
			}
		},
		function(errorCode)
		{
			// Report error.
			callbackFun(null, errorCode);
		}
	);
};

// Stop scanning for devices.
app.stopScan = function() {
	logger("Stopping the scan");
	evothings.ble.stopScan();
};

// Called when Start Scan button is selected.
app.ui.onStartScanButton = function() {
	app.startScan(app.ui.deviceFound);
	app.ui.displayStatus('Scanning...');
	app.ui.updateTimer = setInterval(app.ui.displayDeviceList, 500);
};

// Called when Stop Scan button is selected.
app.ui.onStopScanButton = function() {
	app.stopScan();
	app.devices = {};
	app.ui.displayStatus('Scan Paused');
	app.ui.displayDeviceList();
	clearInterval(app.ui.updateTimer);
};

// Called when a device is found.
app.ui.deviceFound = function(device, errorCode) {
	logger("Device found");
	logger("Device name:", device.name);
	logger("Device address:", device.address);
	logger("Device rssi:", device.rssi);

	if (device) {
		// Set timestamp for device (this is used to remove
		// inactive devices).
		device.timeStamp = Date.now();

		// Insert the device into table of found devices.
		app.devices[device.address] = device;
	}
	else if (errorCode) {
		app.ui.displayStatus('Scan Error: ' + errorCode);
	}
};

// Display the device list.
app.ui.displayDeviceList = function() {
	logger("Device List:", app.devices)
	const foundDevices = document.getElementById('found-devices');

	// Clear device list.
  while(foundDevices.firstChild) {
    foundDevices.removeChild(foundDevices.firstChild);
  }
	const timeNow = Date.now();

	for (let address in app.devices) {
		const device = app.devices[address];

		// Only show devices that are updated during the last 10 seconds.
		if (device.timeStamp + 10000 > timeNow) {
			// Map the RSSI value to a width in percent for the indicator.
			let rssiWidth = 100; // Used when RSSI is zero or greater.
			if (device.rssi < -100) { rssiWidth = 0; }
			else if (device.rssi < 0) { rssiWidth = 100 + device.rssi; }

			// Create tag for device data.
			const content =
				'<strong>' + device.name + '</strong><br />'
				// Do not show address on iOS since it can be confused
				// with an iBeacon UUID.
				+	(os.isIOS() ? '' : device.address + '<br />')
				+	device.rssi + '<br />'
				+ 	'<div style="background:rgb(225,0,0);height:20px;width:'
				+ 		rssiWidth + '%;"></div>';

			let newEntry = document.createElement('li');
  		newEntry.innerHTML = content;
  		foundDevices.appendChild(newEntry);
		}
	};
};

// Display a status message
app.ui.displayStatus = function(message) {
	const scanStatus = document.getElementById('scan-status');
	scanStatus.innerHTML = message;
};

window.onload = function(){
	logger("onload() called")
	document.addEventListener('deviceready', app.onDeviceReady, false);
	applyiOS7LayoutHack();
};
