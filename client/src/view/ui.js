"use strict"

const phone = require('./phone');
const logger = require('../utility').logger;
const arrayToHex = require('../utility').arrayToHex;
const Scan = require('../model/scan');
const Repository = require('../network/repository');
const repository = new Repository("http://192.168.1.74:8080");

// Timer that updates the device list and removes inactive
// devices in case no devices are found by scan.
let updateTimer = null;
let scan = null;

const clearEmail = function() {
	document.getElementById("ui-div").removeChild(document.getElementById("email-div"));
}

const initialize = function() {
	cordova.plugins.backgroundMode.on('activate', function() {
		logger("Entering background mode");
	});

	cordova.plugins.backgroundMode.on('deactivate', function() {
		logger("Entering foreground mode");
	});

	if (repository.hasToken) {
		clearEmail();
		startScanning();
	}
};

const onSaveButton = function() {
	const email = document.getElementById('email-address').value.trim().toLowerCase();
	if (email.length > 0) {
		repository.authorize(email, function(success, message) {
			// Need this error to be meaningful
			if (success) {
				alert("Phone successfully registered.");
				// Clear the email from the UI and start scanning
				clearEmail();
				startScanning();
			}
			else {
				const alertMessage = (message) ? message : "Phone registration failed. Please check that your email address is correct."
				alert(alertMessage);
			}
		})
	}
	else {
		alert("You must enter an email address.");
	}
};

// Called when Start Scan button is selected.
const startScanning = function() {
	scan = new Scan(
		repository.foundBeacon.bind(repository),
		repository.lostBeacon.bind(repository),
		function(errorCode) { displayStatus('Scan Error: ' + errorCode); }
	);
	scan.start();
	updateTimer = setInterval(displayDeviceList, 500);
	displayStatus('Scanning...');
};

// Display the device list.
const displayDeviceList = function() {
	const devices = scan.beacons;
	const foundDevices = document.getElementById('found-devices-div');

  // UI not visible if in background mode so do nothing
	if (cordova.plugins.backgroundMode.isActive()) return;

	// Clear device list.
  while (foundDevices.firstChild) {
    foundDevices.removeChild(foundDevices.firstChild);
  }
	const timeNow = Date.now();

	if (Object.keys(devices).length === 0) {
		// There are no devices in the list
		let newEntry = document.createElement('p');
		newEntry.innerText = "No beacons in range.";
		foundDevices.appendChild();
	}
	else {
		for (let address in devices) {
			const device = devices[address];

			// Map the RSSI value to a width in percent for the indicator.
			let rssiWidth = 100; // Used when RSSI is zero or greater.
			if (device.rssi < -100) { rssiWidth = 0; }
			else if (device.rssi < 0) { rssiWidth = 100 + device.rssi; }

			// Create tag for device data.
			const content =
				'<tr><td width="33%">Beacon Id</td><td><strong>' + arrayToHex(device.bid) + '</strong></td></tr>' +
				'<tr><td>RSSI</td><td><strong>' + device.rssi + '</strong></td></tr>';

			let newEntry = document.createElement('table');
			newEntry.innerHTML = content;
			foundDevices.appendChild(newEntry);
		};
	};
};

// Display a status message
const displayStatus = function(message) {
	const scanStatus = document.getElementById('scan-status-div');
	scanStatus.innerHTML = '<i>' + message + '</i>';
};

module.exports = {
	onSaveButton: onSaveButton,
	initialize: initialize
}
