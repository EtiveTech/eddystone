"use strict"

const logger = require('../utility').logger;
const bleUtility = require('./ble_utility');

const CITY4AGE_NAMESPACE = 'edd1ebeac04e5defa017';

const Scan = function(onFound, onLost, onError){
	this._onFound = onFound;
	this._onLost = onLost;
	this._onError = onError;
	this._tidyTimer = null;
	this._beacons = null;
	this._scanning = false;

	evothings.ble.stopScan();

  Object.defineProperty(this, "beacons", { get: function(){ return this._beacons; } }); 
};

Scan.prototype.start = function(onError) {
	// Start scanning.
	logger("Starting the scan");
	this._beacons = {};
	this._tidyTimer = setInterval(this._tidyBeaconList.bind(this), 1000);
	this._scanning = true;
	evothings.ble.startScan(
		['0000FEAA-0000-1000-8000-00805F9B34FB'],
		function(device) { this._onDeviceFound(device, onError) }.bind(this),
		this._onError
	);
};

// Stop scanning for beacons.
Scan.prototype.stop = function() {
	logger("Stopping the scan");
	if (this._tidyTimer) clearInterval(this._tidyTimer);
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
	logger("Device found", device.address);
	let newDevice = !this._beacons[device.address];
	logger("Device", device.address, (newDevice) ? "is NOT" : "is", "recorded as an in-range beacon");

	// Add a timestamp to the device so it can be timed out and removed
	device.timestamp = Date.now();

	if (newDevice) {
		// Ensure we have advertisementData.
		bleUtility.addAdvertisementData(device);

		// Call callback function with device info.
		// onComplete(device);
		// A device might be an Eddystone if it has advertisementData...
		let ad = device.advertisementData;
		if(!ad) {
			logger("Device", device.address, "has no advertisment data");
			return;
		}
		// With serviceData...
		let sd = ad.kCBAdvDataServiceData;
		if(!sd) {
			logger("Device", device.address, "has no advanced data service data");
			return;
		}
		// And the 0xFEAA service.
		let base64data = sd['0000feaa' + bleUtility.BLUETOOTH_BASE_UUID];
		if(!base64data) {
			logger("Device", device.address, "has no base64 data");
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
			logger("Device", device.address, "sent out a UID frame.")
			if (bleUtility.arrayToHexString(device.nid) === CITY4AGE_NAMESPACE) {
				// We have a City4Age beacon
				if (this._onFound) this._onFound(device);
				this._beacons[device.address] = device;
				logger("Device", device.address, "is beacon", bleUtility.arrayToHexString(device.bid));
			}
		}

	}
	else {
		// Avoid havin to rescan everything - already know it's a beacon
		let storedBeacon = this._beacons[device.address];
		storedBeacon.rssi = device.rssi;
		storedBeacon.timestamp = device.timestamp;
		// storedBeacon.name = device.name;
		// storedBeacon.scanRecord = device.scanRecord;
		// storedBeacon.advertisementData = device.advertisementData;
	}
}

Scan.prototype._tidyBeaconList = function() {
	const TIMEOUT = 10000; // 10 seconds
	const timeNow = Date.now();
	const addresses = Object.keys(this._beacons);
	for (let address of addresses) {
		const beacon = this._beacons[address];
		// Only show devices that are updated during the last 10 seconds.
		if (beacon.timestamp + TIMEOUT < timeNow) {
			logger("Beacon", bleUtility.arrayToHexString(beacon.bid), "is no longer nearby")
			if (this._onLost) this._onLost(this._beacons[address]);
			delete this._beacons[address];
		}
	}
}

module.exports = Scan;