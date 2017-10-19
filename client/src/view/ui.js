"use strict"

const logger = require('../utility').logger;
const arrayToHex = require('../utility').arrayToHex;
const Scanner = require('../model/scanner');
const maxBeacons = 8;

const UI = function(repository) {

	// ***** Initialise variables *****

	this._repository = repository;
	this._scanner = null;
	this._updateTimer = null; // Timer that updates the device list and removes inactive devices.
	this._uiHidden = false;	// UI cannot be hidden at start-up

	// ***** Setup plugins *****

	cordova.plugins.backgroundMode.on('activate', function() {
		logger.log("Entering background mode");
	});

	cordova.plugins.backgroundMode.on('deactivate', function() {
		logger.log("Entering foreground mode");
	});

	cordova.plugins.backgroundMode.setDefaults({
	    title:   'App running in the background',
	    text:    'Scanning for beacons.',
	    icon:    'icon',
	    bigText: false,
	    resume:  true,
	    hidden:  true
	});

	if (device.platform === "Android") {
		// No back button on iOS
		cordova.plugins.backgroundMode.overrideBackButton();
	}

	// Get the version number
	cordova.getAppVersion.getVersionNumber(function (version) {
		document.getElementById('version').innerText = "v" + version;
	});

	// ***** Add Listeners *****

  // Don't update the UI if it's not visible
	document.addEventListener("pause", this.onPause.bind(this), false);
	document.addEventListener("resume", this.onResume.bind(this), false);

	// ***** Start the scanner *****

	if (this._repository.hasToken) {
		// The user has already registered.
		this._postRegistration();
		this._startScanning();
	}
	else {
		// The user has not yet registered.
		this._preRegistration();
	}
}

UI.prototype.onPause = function() {
	this._uiHidden = true;
}

UI.prototype.onResume = function() {
	this._uiHidden = false;
}

UI.prototype.onSaveButton = function(event) {
	// disable the button while attemptiong to register
	event.target.disabled = true;
	this._registerPhone(function(success){
		if (success) {
			// Clear the email from the UI and start scanning
			this._postRegistration();
			const permissions = cordova.plugins.permissions
			permissions.checkPermission(permissions.ACCESS_COARSE_LOCATION, function(checked){
			  if (checked.hasPermission)
			  	this._startScanning();
			  else
			  	permissions.requestPermission(permissions.ACCESS_COARSE_LOCATION,
			  		function(){ this._startScanning(); }.bind(this));
			}.bind(this));
		}
		event.target.disabled = false;
	}.bind(this));
}

UI.prototype._postRegistration = function() {
	document.getElementById("email-div").setAttribute("style", "display:none;");
	document.getElementById("textbox").setAttribute("style", "display:block;");
	document.getElementById("found-devices-div").setAttribute("style", "display:block;");
}

UI.prototype._preRegistration = function() {
	document.getElementById("save-button").onclick = this.onSaveButton.bind(this);
	document.getElementById("email-div").setAttribute("style", "display:block;");
}

UI.prototype._registerPhone = function(onRegistration) {
	const email = document.getElementById("email-address").value.trim().toLowerCase();
	if (email.length > 0) {
		this._repository.authorize(email, function(success, message) {
			// Need this error to be meaningful
			if (success) {
				navigator.notification.alert("Your phone has been successfully registered.",
					function() { onRegistration(success); }, "Success", "OK");
			}
			else {
				const alertMessage = (message) ? message : "Please check that you have an Internet connection and that your email address is correct."
				navigator.notification.alert(alertMessage,
					function() { onRegistration(success); }, "Registration Failed", "OK");
			}
		})
	}
	else {
		navigator.notification.alert("You must enter an email address before registering.", null, "Registration Failed", "OK");
	}
};

UI.prototype._startScanning = function() {
	this._scanner = new Scanner(this._repository,
		function(message) { this._displayStatus(message); }.bind(this)
	);
	this._scanner.start();
	this._updateTimer = setInterval(this._displayDeviceList.bind(this), 500);
};

UI.prototype._beaconOrder = function(a, b) {
	if (a.bid === b.bid) return 0; // This should never happen
	return (a.bid > b.bid) ? 1 : -1;
}

// Display the device list.
UI.prototype._displayDeviceList = function() {
	const devices = this._scanner.beacons;
	const foundDevices = document.getElementById('found-devices-div');

  // If paused, the UI is not visible so there is no need to update the screen
	if (this._uiHidden) return;

	// Clear device list.
  while (foundDevices.firstChild) {
    foundDevices.removeChild(foundDevices.firstChild);
  }
	const timeNow = Date.now();

	if (Object.keys(devices).length === 0) {
		// There are no devices in the list
		let newEntry = document.createElement('p');
		newEntry.setAttribute("align", "center");
		newEntry.setAttribute("style", "font-weight:bold;");
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
		confirmedBeacons.sort(this._beaconOrder);
		unconfirmedBeacons.sort(this._beaconOrder);
		let beacons = confirmedBeacons.concat(unconfirmedBeacons);

		let beaconCount = 0;
		for (let i = 0; i < beacons.length; i++) {
		// for (let beacon of beacons) {
			// Create tag for device data.
			const beacon = beacons[i];
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
UI.prototype._displayStatus = function(message) {
	const scanStatus = document.getElementById('scan-status');
	scanStatus.innerText = message;
	cordova.plugins.backgroundMode.configure({ text: message });
};

module.exports = UI;