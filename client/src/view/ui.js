"use strict"

const logger = require('../utility').logger;
const arrayToHex = require('../utility').arrayToHex;
const Scanner = require('../model/scanner');
const Repository = require('../network/repository');
const maxBeacons = 8;

// Timer that updates the device list and removes inactive
// devices in case no devices are found by scan.
let updateTimer = null;
let repository = null;
let scanner = null;
let uiHidden = false;	// UI cannot be hidden at start-up

const clearEmail = function() {
	document.getElementById("ui").removeChild(document.getElementById("email-div"));
}

const onPause = function() {
	logger("Pause event raised");
	uiHidden = true;
}

const onResume = function() {
	logger("Resume event raised");
	uiHidden = false;
}

const initialize = function() {
	cordova.plugins.backgroundMode.on('activate', function() {
		logger("Entering background mode");
	});

	cordova.plugins.backgroundMode.on('deactivate', function() {
		logger("Entering foreground mode");
	});

	if (device.platform === "Android") {
		// No back button on iOS
		cordova.plugins.backgroundMode.overrideBackButton();
	}

	repository = new Repository((process.env.NODE_ENV === 'test') ? "https://cj101d.ifdnrg.com/api" : "https://c4a.etive.org:8443/api");

	if (repository.hasToken) {
		clearEmail();
		startScanning();
	}
	
	document.addEventListener("pause", onPause, false);
	document.addEventListener("resume", onResume, false);	
};

const onSaveButton = function() {
	const email = document.getElementById('email-address').value.trim().toLowerCase();
	if (email.length > 0) {
		repository.authorize(email, function(success, message) {
			// Need this error to be meaningful
			if (success) {
				navigator.notification.alert("Your phone has been successfully registered.", null, "Success", "OK");
				// Clear the email from the UI and start scanning
				clearEmail();
				startScanning();
			}
			else {
				const alertMessage = (message) ? message : "Please check that you have an Internet connection and that your email address is correct."
				navigator.notification.alert(alertMessage, null, "Registration Failed", "OK");
			}
		})
	}
	else {
		navigator.notification.alert("You must enter an email address before registering.", null, "Registration Failed", "OK");
	}
};

const startScanning = function() {
	scanner = new Scanner(repository,
		function(message) { displayStatus(message); }
	);
	scanner.start();
	updateTimer = setInterval(displayDeviceList, 500);
	displayStatus('Scanning...');
};

const beaconOrder = function(a, b) {
	if (a.bid === b.bid) return 0; // This should never happen
	return (a.bid > b.bid) ? 1 : -1;
}

// Display the device list.
const displayDeviceList = function() {
	const devices = scanner.beacons;
	const foundDevices = document.getElementById('found-devices-div');

  // If paused, the UI is not visible so there is no need to update the screen
	if (uiHidden) return;

	// Clear device list.
  while (foundDevices.firstChild) {
    foundDevices.removeChild(foundDevices.firstChild);
  }
	const timeNow = Date.now();

	if (Object.keys(devices).length === 0) {
		// There are no devices in the list
		let newEntry = document.createElement('p');
		newEntry.innerText = "No beacons in range.";
		foundDevices.appendChild(newEntry);
	}
	else {
		let confirmedBeacons = [];
		let unconfirmedBeacons = [];
		for (let address in devices) {
			let device = devices[address];
			if (device.confirmed)
				confirmedBeacons.push(device);
			else
				unconfirmedBeacons.push(device);
		}
		confirmedBeacons.sort(beaconOrder);
		unconfirmedBeacons.sort(beaconOrder);
		let beacons = confirmedBeacons.concat(unconfirmedBeacons);

		let beaconCount = 0;
		for (let beacon of beacons) {
			// Create tag for device data.
			const status = (beacon.confirmed) ? "confirmed" : "unconfirmed";
			const content =
				'<tr>' +
				  '<td width="40%">Beacon Id :</td>' +
				  '<td class="' + status + '">' + arrayToHex(beacon.bid) + '</td>' +
				'</tr>' +
				'<tr>' +
				  '<td>RSSI :</td>' +
				  '<td class="' + status + '">' + beacon.rssi + '</td>' +
				'</tr>';

			let newEntry = document.createElement('table');
			newEntry.innerHTML = content;
			if (beacon.confirmed) newEntry.className = "bordered";
			foundDevices.appendChild(newEntry);
			beaconCount += 1;
			if (beaconCount >= maxBeacons) break;
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
