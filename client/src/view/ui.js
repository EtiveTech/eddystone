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
let email = "";

const emptyEmail = function() {
	let html = document.getElementById("email");
	while (html.firstChild) {
		html.removeChild(html.firstChild);
	}
	return html;
}

const emailForDisplay = function() {
	const text = document.createElement("input");
	text.placeholder = "email address"
	text.value = email;
	text.id = "emailText";
	text.readOnly = true;

	const button = document.createElement("button");
	button.innerText = "Edit";
	button.id = "editButton";
	button.class = "charcoal";
	button.onclick = function() { emailForEdit(email); };

	const div = emptyEmail();
	div.appendChild(text);
	div.appendChild(button);
}

const emailForEdit = function() {
	const text = document.createElement("input");
	text.placeholder = "email address"
	text.value = email;
	text.type = "email";
	text.id = "emailText"

	const button = document.createElement("button");
	button.innerText = "Send";
	button.id = "sendButton";
	button.class = "charcoal";
	button.onclick = function() {
		email = text.value.trim();
		repository.authorize(email, function(success) {
			// Need this error to be meaningful
			if (!success) alert("Send failed");
			emailForDisplay();
		})
	}

	const div = emptyEmail();
	div.appendChild(text);
	div.appendChild(button);
}

const initialize = function() {
	cordova.plugins.backgroundMode.on('activate', function() {
		logger("Entering background mode");
	});

	cordova.plugins.backgroundMode.on('deactivate', function() {
		logger("Entering foreground mode");
	});

	emailForDisplay(email);
};

// Called when Start Scan button is selected.
const onStartScanButton = function() {
	repository.authorize("test@etive.org", function(status) {
		scan = new Scan(repository.foundBeacon.bind(repository), repository.lostBeacon.bind(repository), function(errorCode) {
			displayStatus('Scan Error: ' + errorCode);
		});
		scan.start();
		updateTimer = setInterval(displayDeviceList, 500);
		displayStatus('Scanning...');
	});
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

  // UI not visible if in background mode
	if (cordova.plugins.backgroundMode.isActive()) return;

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
			'<tr><td width="33%">Beacon Id</td><td><strong>' + arrayToHex(device.bid) + '</strong></td></tr>' +
			'<tr><td>RSSI</td><td><strong>' + device.rssi + '</strong></td></tr>';

		let newEntry = document.createElement('table');
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
	onStopScanButton: onStopScanButton,
	initialize: initialize
}
