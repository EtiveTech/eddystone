"use strict"

const phone = require('./phone');
const logger = require('../utility').logger;
const arrayToHex = require('../model/ble_utility').arrayToHexString;
const Scan = require('../model/scan');
const Repository = require('../network/repository');
const repository = new Repository("http://cj101d.ifdnrg.com", "test@digitallogbook.co");

// Timer that updates the device list and removes inactive
// devices in case no devices are found by scan.
let updateTimer = null;
let scan = null;

// Called when Start Scan button is selected.
const onStartScanButton = function() {
	scan = new Scan(repository.foundBeacon.bind(repository), repository.lostBeacon.bind(repository), function(errorCode) {
		displayStatus('Scan Error: ' + errorCode);
	});
	scan.start();
	updateTimer = setInterval(displayDeviceList, 500);
	displayStatus('Scanning...');
};

// Called when Stop Scan button is selected.
const onStopScanButton = function() {
	scan.stop();
	clearInterval(updateTimer);
	displayStatus('Scan Paused');
	displayDeviceList();
};

// Display the device list.
const displayDeviceList = function() {
	const devices = scan.beacons;
	const foundDevices = document.getElementById('found-devices');

	// Clear device list.
  while(foundDevices.firstChild) {
    foundDevices.removeChild(foundDevices.firstChild);
  }
	const timeNow = Date.now();

	for (let address in devices) {
		const device = devices[address];

		// Map the RSSI value to a width in percent for the indicator.
		let rssiWidth = 100; // Used when RSSI is zero or greater.
		if (device.rssi < -100) { rssiWidth = 0; }
		else if (device.rssi < 0) { rssiWidth = 100 + device.rssi; }

		// Create tag for device data.
		const content =
			'<strong>' + arrayToHex(device.nid) + "<br />" + arrayToHex(device.bid) + '</strong><br />'
			// Do not show address on iOS since it can be confused
			// with an iBeacon UUID.
			+	(phone.isIOS ? '' : device.address + '<br />')
			+	device.rssi + '<br />'
			+ 	'<div style="background:rgb(225,0,0);height:20px;width:'
			+ 		rssiWidth + '%;"></div>';

		let newEntry = document.createElement('li');
		newEntry.innerHTML = content;
		foundDevices.appendChild(newEntry);
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
