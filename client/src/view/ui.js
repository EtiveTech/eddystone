"use strict"

const phone = require('./phone');
const logger = require('../utility').logger;
const Scan = require('../model/scan')

// Timer that updates the device list and removes inactive
// devices in case no devices are found by scan.
let updateTimer = null;
let scan = null;

// Called when Start Scan button is selected.
const onStartScanButton = function() {
	scan = new Scan();
	scan.start(function(errorCode) {
		displayStatus('Scan Error: ' + errorCode);
	});
	displayStatus('Scanning...');
	updateTimer = setInterval(displayDeviceList, 500);
};

// Called when Stop Scan button is selected.
const onStopScanButton = function() {
	scan.stop();
	displayStatus('Scan Paused');
	displayDeviceList();
	clearInterval(updateTimer);
};

// Display the device list.
const displayDeviceList = function() {
	const devices = scan.beacons;
	logger("Device List:", devices)
	const foundDevices = document.getElementById('found-devices');

	// Clear device list.
  while(foundDevices.firstChild) {
    foundDevices.removeChild(foundDevices.firstChild);
  }
	const timeNow = Date.now();

	for (let address in devices) {
		const device = devices[address];

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
				+	(phone.isIOS ? '' : device.address + '<br />')
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
const displayStatus = function(message) {
	const scanStatus = document.getElementById('scan-status');
	scanStatus.innerHTML = message;
};

module.exports = {
	onStartScanButton: onStartScanButton,
	onStopScanButton: onStopScanButton
}
