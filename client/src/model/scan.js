"use strict"

const logger = require('../utility').logger;
const bleUtility = require('./ble_utility');


const Scan = function(){
	this._beacons = {};
	this._scanning = false;

	evothings.ble.stopScan();

  Object.defineProperty(this, "beacons", { get: function(){ return this._beacons; } }); 
};

Scan.prototype.start = function(onError) {
	// Start scanning.
	logger("Starting the scan");
	this._scanning = true;
	evothings.ble.startScan(
		['0000FEAA-0000-1000-8000-00805F9B34FB'],
		function(device) { this._onDeviceFound(device, onError) }.bind(this),
		onError
	);
};

Scan.prototype._onDeviceFound = function(device, onError) {
	// Don't report devices unless the isScanning flag is true.
	// This is to prevent devices being reported after stopScanning
	// has been called (this can happen since scanning does not stop
	// instantly when evothings.ble.stopScan is called).
	if (!this._scanning) return;

	logger("Device found", device.address);

	// Ensure we have advertisementData.
	bleUtility.addAdvertisementData(device);

	// Check if we already have got the device.
	let existingDevice = this._beacons[device.address]
	if (existingDevice) {
		logger("Existing device:", device.address);
		// Do not report device again if flag is set.
		// if (allowDuplicates === false || reportDeviceOnce === true) { return; }

		// Duplicates allowed, report device again.
		existingDevice.rssi = device.rssi;
		existingDevice.name = device.name;
		existingDevice.scanRecord = device.scanRecord;
		existingDevice.advertisementData = device.advertisementData;
		device = existingDevice;
	}
	else {
		logger("New device:", device.address);
		// New device, add to known devices.
		this._beacons[device.address] = device;

		// Set connect status.
		device.__isConnected = false;

		// Add methods to the device info object.
		//internal.addMethodsToDeviceObject(device);
	}

	device.timeStamp = Date.now();

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
	switch (byteArray[0]) {
		case 0x00: bleUtility.parseFrameUID(device, byteArray, onError); break;
		case 0x10: bleUtility.parseFrameURL(device, byteArray, onError); break;
		case 0x20: bleUtility.parseFrameTLM(device, byteArray, onError); break;
		case 0x30: bleUtility.parseFrameEID(device, byteArray, onError); break;
	}
}

// Stop scanning for beacons.
Scan.prototype.stop = function() {
	logger("Stopping the scan");
	this._scanning = false;
	evothings.ble.stopScan();
	this._beacons = {};
};


module.exports = Scan;