"use strict"

const logger = require('../utility').logger;

const Scan = function(){
	this._devices = {};
	evothings.ble.stopScan();

  Object.defineProperty(this, "devices", { get: function(){ return this._devices; } }); 
};

Scan.prototype.start = function(onError) {
	// Start the scan. Call the callback function when a device is found.
	// Format:
	//   callbackFun(deviceInfo, errorCode)
	//   deviceInfo: address, rssi, name
	//   errorCode: String

	logger("Starting the scan");

	evothings.ble.startScan(
		function(device) {
			// Report success. Sometimes an RSSI of +127 is reported.
			// We filter out these values here.
			if (device.rssi <= 0) this._deviceFound(device);
		}.bind(this),
		function(errorCode) {
			// Report error.
			onError(errorCode);
		}
	);
};

// Stop scanning for devices.
Scan.prototype.stop = function() {
	logger("Stopping the scan");
	evothings.ble.stopScan();
	this._devices = {};
};

// Called when a device is found.
Scan.prototype._deviceFound = function(device) {
	logger("Device found");
	logger("Device name:", device.name);
	logger("Device address:", device.address);
	logger("Device rssi:", device.rssi);

	// Set timestamp for device (this is used to remove
	// inactive devices).
	device.timeStamp = Date.now();

	// Insert the device into table of found devices.
	this._devices[device.address] = device;
};

module.exports = Scan;