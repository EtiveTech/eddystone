"use strict"

const logger = require('../utility').logger;
const bleUtility = require('./ble_utility');

const CITY4AGE_NAMESPACE = 'edd1ebeac04e5defa017';
const WAIT_TIME = 1400; // Wait 1.4 second before declaring a beacon found
const LOST_FACTOR = 6; // Wait LOST_FACTOR * WAIT_TIME before declaring a beacon lost
const TIDY_INTERVAL = 700; // Wait 0.7 second between tidy events
const RSSI_THRESHOLD = -90; // Beacon is ignored unless the signal is stronger than this
const RESTART_INTERVAL = 5 * 60 * 1000; // Restart the scan every five minutes

const Scan = function(onFound, onLost, onError){
	this._onFound = onFound;
	this._onLost = onLost;
	this._onError = onError;
	this._tidyTimer = null;
	this._restartTimer = null;
	this._beacons = {};
	this._scanning = false;

	evothings.ble.stopScan();

  Object.defineProperty(this, "beacons", { get: function(){ return this._beacons; } }); 
};

Scan.prototype._start = function() {
	evothings.ble.startScan(
		['0000FEAA-0000-1000-8000-00805F9B34FB'],
		function(device) {
			if (device.rssi <= 0) {
				// It seems some iPhones can return 127 as an RSSI value - ignore it
				this._onDeviceFound(device, this._onError)
			}
		}.bind(this),
		this._onError
	);
};

Scan.prototype._restart = function() {
	logger.log("Restarting the BLE scan");
	evothings.ble.stopScan();
	this._start();
}

Scan.prototype.start = function() {
	// Start scanning.
	logger.log("Starting the BLE scan");
	// Don't reinitialise this._beacons
	this._preBeacons = {}; // Beacons that have not (yet) been reported as found
	this._tidyTimer = setInterval(this._tidyBeaconLists.bind(this), TIDY_INTERVAL);
	this._restartTimer = setInterval(this._restart.bind(this), RESTART_INTERVAL);
	this._scanning = true;
	this._start();
};

// Stop scanning for beacons.
Scan.prototype.stop = function(outOfRange) {
	logger.log("Stopping the BLE scan");
	if (this._restartTimer) clearInterval(this._restartTimer);
	if (this._tidyTimer) clearInterval(this._tidyTimer);
	// If geoLocation says there are no beacons in range, forget all the beacons
	if (outOfRange) this._beacons = {};
	this._scanning = false;
	evothings.ble.stopScan();
};

Scan.prototype._onDeviceFound = function(device, onError) {
	// Don't report devices unless the isScanning flag is true.
	// This is to prevent devices being reported after stopScanning
	// has been called (this can happen since scanning does not stop
	// instantly when evothings.ble.stopScan is called).

	if (!this._scanning) return;

	// Different packets may be broadcast by the beacon.
	// Each packet will come from the same device but will have different advertising data
	let newDevice = !(this._beacons[device.address] || this._preBeacons[device.address]);

	// Add a timestamp to the device so it can be timed out and removed
	device.timestamp = Date.now();

	if (newDevice) {
		// logger.log("Device", device.address, "found and is not recorded as an in-range beacon");

		// Ignore devices that don't have a strong signal
		if (device.rssi < RSSI_THRESHOLD) return;

		// Ensure we have advertisementData.
		bleUtility.addAdvertisementData(device);

		// Call callback function with device info.
		// onComplete(device);
		// A device might be an Eddystone if it has advertisementData...
		let ad = device.advertisementData;
		if(!ad) {
			logger.log("Device", device.address, "has no advertisment data");
			return;
		}
		// With serviceData...
		let sd = ad.kCBAdvDataServiceData;
		if(!sd) {
			logger.log("Device", device.address, "has no advanced data service data");
			return;
		}
		// And the 0xFEAA service.
		let base64data = sd['0000feaa' + bleUtility.BLUETOOTH_BASE_UUID];
		if(!base64data) {
			logger.log("Device", device.address, "has no base64 data");
			return;
		}
		let byteArray = bleUtility.base64DecToArr(base64data);

		// If the data matches one of the Eddystone frame formats,
		// we can forward it to the user.
		// switch (byteArray[0]) {
		// 	case 0x00: bleUtility.parseFrameUID(device, byteArray, onError); break;
		// 	case 0x10: bleUtility.parseFrameURL(device, byteArray, onError); break;
		// 	case 0x20: bleUtility.parseFrameTLM(device, byteArray, onError); break;
		// 	case 0x30: bleUtility.parseFrameEID(device, byteArray, onError); break;
		// }

		if ((byteArray[0] === 0) && bleUtility.parseFrameUID(device, byteArray, onError)) {
			// We have a UID frame
			// logger.log("Device", device.address, "sent out a UID frame.")
			if (bleUtility.arrayToHexString(device.nid) === CITY4AGE_NAMESPACE) {
				// We have a City4Age beacon
				device.rssiMax = device.rssi;
				device.foundAfter = device.timestamp + WAIT_TIME;
				device.confirmed = false;
				this._preBeacons[device.address] = device;
				// logger.log("Device", device.address, "is new beacon", bleUtility.arrayToHexString(device.bid));
			}
		}
	}
	else {
		// Avoid having to rescan everything - already know it's a beacon
		const beaconFound = (this._beacons[device.address]) ? true : false;
		let storedBeacon = (beaconFound) ? this._beacons[device.address] : this._preBeacons[device.address];
		storedBeacon.rssi = device.rssi;
		if (storedBeacon.rssiMax < device.rssi) storedBeacon.rssiMax = device.rssi;
		if (beaconFound || device.rssi >= RSSI_THRESHOLD) {
			// IF the beacon is "found" OR hasn't been "found" but has a strong signal THEN update the timestamp
			// This means a strong signal is needed to find a beacon but only a weak signal is required to hold onto it
			storedBeacon.timestamp = device.timestamp;
		}
	}
}

Scan.prototype._tidyBeaconLists = function() {
	const timeNow = Date.now();

	let addresses = Object.keys(this._beacons);
	for (let i = 0; i < addresses.length; i++) {
		const address = addresses[i];
		const beacon = this._beacons[address];
		// Only show devices that are updated during the last 2 seconds.
		if (beacon.timestamp + (WAIT_TIME * LOST_FACTOR) < timeNow) {
			// logger.log("Beacon", bleUtility.arrayToHexString(beacon.bid), "is now lost")
			if (this._onLost) this._onLost(beacon);
			delete this._beacons[address];
		}
	}

	addresses = Object.keys(this._preBeacons);
	for (let i = 0; i < addresses.length; i++) {
	//for (let address of addresses) {
		const address = addresses[i];
		const beacon = this._preBeacons[address];
		if (beacon.timestamp > beacon.foundAfter) {
			// logger.log("Beacon", bleUtility.arrayToHexString(beacon.bid), "is now found");
			this._beacons[beacon.address] = beacon;
			delete this._preBeacons[address];
			if (this._onFound) this._onFound(beacon);
		}
		else if (beacon.foundAfter < timeNow && beacon.timestamp + TIDY_INTERVAL < timeNow) {
			delete this._preBeacons[address];
			// logger.log("Beacon", bleUtility.arrayToHexString(beacon.bid), "has been forgotten");
		}
	}
}

module.exports = Scan;