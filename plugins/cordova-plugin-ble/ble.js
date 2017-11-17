// API definition for EvoThings BLE plugin.
//
// Use jsdoc to generate documentation.

// The following line causes a jsdoc error.
// Use the jsdoc option -l to ignore the error.
var exec = cordova.require('cordova/exec');

/**
 * @module cordova-plugin-ble
 * @description Functions and properties in this module are available
 * under the global name <code>evothings.ble</code>
 */

/********** BLE Central API **********/

// Flag that tracks if scanning is in progress.
//  Used by startScan and stopScan.
var isScanning = false;

/**
 * Start scanning for devices.
 * <p>An array of service UUID strings may be given in the options object parameter.
 * One or more service UUIDs must be specified for iOS background scanning to work.</p>
 * <p>Found devices and errors are reported to the supplied callback functions.</p>
 * <p>Will keep scanning until you call stopScan().</p>
 * <p>To conserve energy, call stopScan() as soon as you've found the device
 * you're looking for.</p>
 * <p>Call stopScan() before calling startScan() again.</p>
 *
 * @param {scanCallback} success - Success callback, called repeatedly
 * for each found device.
 * @param {failCallback} fail - Error callback.
 * @param {ScanOptions} options - Optional object with options.
 * Set field serviceUUIDs to an array of service UUIDs to scan for.
 * Set field parseAdvertisementData to false to disable automatic
 * parsing of advertisement data.
 *
 * @example
 *   // Scan for all services.
 *   evothings.ble.startScan(
 *       function(device)
 *       {
 *           console.log('startScan found device named: ' + device.name);
 *       },
 *       function(errorCode)
 *       {
 *           console.log('startScan error: ' + errorCode);
 *       }
 *   );
 *
 *   // Scan for specific service (Eddystone Service UUID).
 *   evothings.ble.startScan(
 *       function(device)
 *       {
 *           console.log('startScan found device named: ' + device.name);
 *       },
 *       function(errorCode)
 *       {
 *           console.log('startScan error: ' + errorCode);
 *       },
 *       { serviceUUIDs: ['0000feaa-0000-1000-8000-00805f9b34fb'] }
 *   );
 */
exports.startScan = function(arg1, arg2, arg3, arg4)
{
	// Scanning parameters.
	var serviceUUIDs;
	var success;
	var fail;
	var options;
	var parseAdvertisementData = true;

	function onFail(error) {
		isScanning = false;
		fail(error);
	}

	function onSuccess(device) {
		// Only report results while scanning is requested.
		if (isScanning) {
			if (parseAdvertisementData) {
				exports.parseAdvertisementData(device);
			}
			success(device);
		}
	}

	// Determine parameters.
	if (Array.isArray(arg1)) {
		// First param is an array of serviceUUIDs.
		serviceUUIDs = arg1;
		success = arg2;
		fail = arg3;
		options = arg4;
	}
	else if ('function' == typeof arg1) {
		// First param is a function.
		serviceUUIDs = null;
		success = arg1;
		fail = arg2;
		options = arg3;
	}

	if (isScanning) {
		fail('Scan already in progress');
		return;
	}

	isScanning = true;

	// Set options.
	if (options) {
		if (Array.isArray(options.serviceUUIDs)) {
			serviceUUIDs = options.serviceUUIDs;
		}

		if (options.parseAdvertisementData === true) {
			parseAdvertisementData = true;
		}
		else if (options.parseAdvertisementData === false) {
			parseAdvertisementData = false;
		}
	}

	// Start scanning.
	isScanning = true;
	if (Array.isArray(serviceUUIDs)) {
		serviceUUIDs = getCanonicalUUIDArray(serviceUUIDs);
		exec(onSuccess, onFail, 'BLE', 'startScan', [serviceUUIDs]);
	}
	else {
		exec(onSuccess, onFail, 'BLE', 'startScan', []);
	}
};

/**
 * Ensure that all UUIDs in an array has canonical form.
 * @private
 */
function getCanonicalUUIDArray(uuidArray) {
	var result = [];

	for (var i in uuidArray) {
		result.push(exports.getCanonicalUUID(uuidArray[i]));
	}

	return result;
}

/**
 * Options for startScan.
 * @typedef {Object} ScanOptions
 * @param {array} serviceUUIDs - Array with service UUID strings (optional).
 * On iOS multiple UUIDs are scanned for using logical OR operator,
 * any UUID that matches any of the UUIDs adverticed by the device
 * will count as a match. On Android, multiple UUIDs are scanned for
 * using AND logic, the device must advertise all of the given UUIDs
 * to produce a match. (The matching logic will be unified in future
 * versions of the plugin.) When providing one service UUID, behaviour
 * is the same on Android and iOS. Learning out this parameter or
 * setting it to null, will scan for all devices, regardless of
 * advertised services.
 * @property {boolean} parseAdvertisementData - Set to false to disable
 * automatic parsing of advertisement data from the scan record.
 * Default is true.
 */

/**
 * This function is a parameter to startScan() and is called when a new device is discovered.
 * @callback scanCallback
 * @param {DeviceInfo} device
 */

/**
 * Info about a BLE device.
 * @typedef {Object} DeviceInfo
 * @property {string} address - Uniquely identifies the device.
 * Pass this to connect().
 * The form of the address depends on the host platform.
 * @property {number} rssi - A negative integer, the signal strength in decibels.
 * @property {string} name - The device's name, or nil.
 * @property {string} scanRecord - Base64-encoded binary data.
 * Its meaning is device-specific. Not available on iOS.
 * @property {AdvertisementData} advertisementData - Object containing some
 * of the data from the scanRecord. Available natively on iOS. Available on
 * Android by parsing the scanRecord, which is implemented in the library EasyBLE:
 * {@link https://github.com/evothings/evothings-libraries/blob/master/libs/evothings/easyble/easyble.js}.
 */

/**
 * Information extracted from a scanRecord. Some or all of the fields may
 * be undefined. This varies between BLE devices.
 * Depending on OS version and BLE device, additional fields, not documented
 * here, may be present.
 * @typedef {Object} AdvertisementData
 * @property {string} kCBAdvDataLocalName - The device's name. Might or might
 * not be equal to DeviceInfo.name. iOS caches DeviceInfo.name which means if
 * the name is changed on the device, the new name might not be visible.
 * kCBAdvDataLocalName is not cached and is therefore safer to use, when available.
 * @property {number} kCBAdvDataTxPowerLevel - Transmission power level as
 * advertised by the device.
 * @property {number} kCBAdvDataChannel - A positive integer, the BLE channel
 * on which the device listens for connections. Ignore this number.
 * @property {boolean} kCBAdvDataIsConnectable - True if the device accepts
 * connections. False if it doesn't.
 * @property {array} kCBAdvDataServiceUUIDs - Array of strings, the UUIDs of
 * services advertised by the device. Formatted according to RFC 4122, all lowercase.
 * @property {object} kCBAdvDataServiceData - Dictionary of strings to strings.
 * The keys are service UUIDs. The values are base-64-encoded binary data.
 * @property {string} kCBAdvDataManufacturerData - Base-64-encoded binary data.
 * This field is used by BLE devices to advertise custom data that don't fit into
 * any of the other fields.
 */

/**
 * This function is called when an operation fails.
 * @callback failCallback
 * @param {string} errorString - A human-readable string that describes the error that occurred.
 */

/**
 * Stops scanning for devices.
 *
 * @example
 *   evothings.ble.stopScan();
 */
exports.stopScan = function() {
	isScanning = false;
	exec(null, null, 'BLE', 'stopScan', []);
};

// Create closure for parseAdvertisementData and helper functions.
// TODO: Investigate if the code can be simplified, compare to how
// how the Evothings Bleat implementation does this.
;(function() {
var base64;

/**
 * Parse the advertisement data in the scan record.
 * If device already has AdvertisementData, does nothing.
 * If device instead has scanRecord, creates AdvertisementData.
 * See  {@link AdvertisementData} for reference documentation.
 * @param {DeviceInfo} device - Device object.
 */
exports.parseAdvertisementData = function(device) {
	if (!base64) { base64 = cordova.require('cordova/base64'); }

	// If device object already has advertisementData we
	// do not need to parse the scanRecord.
	if (device.advertisementData) { return; }

	// Must have scanRecord yo continue.
	if (!device.scanRecord) { return; }

	// Here we parse BLE/GAP Scan Response Data.
	// See the Bluetooth Specification, v4.0, Volume 3, Part C, Section 11,
	// for details.

	var byteArray = base64DecToArr(device.scanRecord);
	var pos = 0;
	var advertisementData = {};
	var serviceUUIDs;
	var serviceData;

	// The scan record is a list of structures.
	// Each structure has a length byte, a type byte, and (length-1) data bytes.
	// The format of the data bytes depends on the type.
	// Malformed scanRecords will likely cause an exception in this function.
	while (pos < byteArray.length) {
		var length = byteArray[pos++];
		if (length == 0) break;
		length -= 1;
		var type = byteArray[pos++];

		// Parse types we know and care about.
		// Skip other types.

		var BLUETOOTH_BASE_UUID = '-0000-1000-8000-00805f9b34fb'

		// Convert 16-byte Uint8Array to RFC-4122-formatted UUID.
		function arrayToUUID(array, offset) {
			var k=0;
			var string = '';
			var UUID_format = [4, 2, 2, 2, 6];
			for (var l=0; l<UUID_format.length; l++) {
				if (l != 0) string += '-';
				for (var j=0; j<UUID_format[l]; j++, k++) {
					string += toHexString(array[offset+k], 1);
				}
			}
			return string;
		}

		if (type == 0x02 || type == 0x03) { // 16-bit Service Class UUIDs.
			serviceUUIDs = serviceUUIDs ? serviceUUIDs : [];
			for(var i=0; i<length; i+=2) {
				serviceUUIDs.push(
					'0000' +
					toHexString(
						littleEndianToUint16(byteArray, pos + i),
						2) +
					BLUETOOTH_BASE_UUID);
			}
		}

		if (type == 0x04 || type == 0x05) { // 32-bit Service Class UUIDs.
			serviceUUIDs = serviceUUIDs ? serviceUUIDs : [];
			for (var i=0; i<length; i+=4) {
				serviceUUIDs.push(
					toHexString(
						littleEndianToUint32(byteArray, pos + i),
						4) +
					BLUETOOTH_BASE_UUID);
			}
		}

		if (type == 0x06 || type == 0x07) {// 128-bit Service Class UUIDs.
			serviceUUIDs = serviceUUIDs ? serviceUUIDs : [];
			for (var i=0; i<length; i+=16) {
				serviceUUIDs.push(arrayToUUID(byteArray, pos + i));
			}
		}

		if (type == 0x08 || type == 0x09) { // Local Name.
			advertisementData.kCBAdvDataLocalName = evothings.ble.fromUtf8(
				new Uint8Array(byteArray.buffer, pos, length));
		}

		if (type == 0x0a) { // TX Power Level.
			advertisementData.kCBAdvDataTxPowerLevel =
				littleEndianToInt8(byteArray, pos);
		}

		if (type == 0x16) { // Service Data, 16-bit UUID.
			serviceData = serviceData ? serviceData : {};
			var uuid =
				'0000' +
				toHexString(
					littleEndianToUint16(byteArray, pos),
					2) +
				BLUETOOTH_BASE_UUID;
			var data = new Uint8Array(byteArray.buffer, pos+2, length-2);
			serviceData[uuid] = base64.fromArrayBuffer(data);
		}

		if (type == 0x20) { // Service Data, 32-bit UUID.
			serviceData = serviceData ? serviceData : {};
			var uuid =
				toHexString(
					littleEndianToUint32(byteArray, pos),
					4) +
				BLUETOOTH_BASE_UUID;
			var data = new Uint8Array(byteArray.buffer, pos+4, length-4);
			serviceData[uuid] = base64.fromArrayBuffer(data);
		}

		if (type == 0x21) { // Service Data, 128-bit UUID.
			serviceData = serviceData ? serviceData : {};
			var uuid = arrayToUUID(byteArray, pos);
			var data = new Uint8Array(byteArray.buffer, pos+16, length-16);
			serviceData[uuid] = base64.fromArrayBuffer(data);
		}

		if (type == 0xff) {// Manufacturer-specific Data.
			// Annoying to have to transform base64 back and forth,
			// but it has to be done in order to maintain the API.
			advertisementData.kCBAdvDataManufacturerData =
				base64.fromArrayBuffer(new Uint8Array(byteArray.buffer, pos, length));
		}

		pos += length;
	}
	advertisementData.kCBAdvDataServiceUUIDs = serviceUUIDs;
	advertisementData.kCBAdvDataServiceData = serviceData;
	device.advertisementData = advertisementData;

	/*
	// Log raw data for debugging purposes.

	console.log("scanRecord: "+evothings.util.typedArrayToHexString(byteArray));

	console.log(JSON.stringify(advertisementData));
	*/
};

/**
 * Decodes a Base64 string. Returns a Uint8Array.
 * nBlocksSize is optional.
 * @param {String} sBase64
 * @param {int} nBlocksSize
 * @return {Uint8Array}
 * @public
 */
function base64DecToArr(sBase64, nBlocksSize) {
	var sB64Enc = sBase64.replace(/[^A-Za-z0-9\+\/]/g, "");
	var nInLen = sB64Enc.length;
	var nOutLen = nBlocksSize ?
		Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize
		: nInLen * 3 + 1 >> 2;
	var taBytes = new Uint8Array(nOutLen);

	for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
		nMod4 = nInIdx & 3;
		nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 18 - 6 * nMod4;
		if (nMod4 === 3 || nInLen - nInIdx === 1) {
			for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
				taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
			}
			nUint24 = 0;
		}
	}

	return taBytes;
}

/**
 * Converts a single Base64 character to a 6-bit integer.
 * @private
 */
function b64ToUint6(nChr) {
	return nChr > 64 && nChr < 91 ?
			nChr - 65
		: nChr > 96 && nChr < 123 ?
			nChr - 71
		: nChr > 47 && nChr < 58 ?
			nChr + 4
		: nChr === 43 ?
			62
		: nChr === 47 ?
			63
		:
			0;
}

/**
 * Returns the integer i in hexadecimal string form,
 * with leading zeroes, such that
 * the resulting string is at least byteCount*2 characters long.
 * @param {int} i
 * @param {int} byteCount
 * @public
 */
function toHexString(i, byteCount) {
	var string = (new Number(i)).toString(16);
	while(string.length < byteCount*2) {
		string = '0'+string;
	}
	return string;
}

/**
 * Interpret byte buffer as unsigned little endian 16 bit integer.
 * Returns converted number.
 * @param {ArrayBuffer} data - Input buffer.
 * @param {number} offset - Start of data.
 * @return Converted number.
 * @public
 */
function littleEndianToUint16(data, offset) {
	return (littleEndianToUint8(data, offset + 1) << 8) +
		littleEndianToUint8(data, offset)
}

/**
 * Interpret byte buffer as unsigned little endian 32 bit integer.
 * Returns converted number.
 * @param {ArrayBuffer} data - Input buffer.
 * @param {number} offset - Start of data.
 * @return Converted number.
 * @public
 */
function littleEndianToUint32(data, offset) {
	return (littleEndianToUint8(data, offset + 3) << 24) +
		(littleEndianToUint8(data, offset + 2) << 16) +
		(littleEndianToUint8(data, offset + 1) << 8) +
		littleEndianToUint8(data, offset)
}

/**
 * Interpret byte buffer as little endian 8 bit integer.
 * Returns converted number.
 * @param {ArrayBuffer} data - Input buffer.
 * @param {number} offset - Start of data.
 * @return Converted number.
 * @public
 */
function littleEndianToInt8(data, offset) {
	var x = littleEndianToUint8(data, offset)
	if (x & 0x80) x = x - 256
	return x
}

/**
 * Interpret byte buffer as unsigned little endian 8 bit integer.
 * Returns converted number.
 * @param {ArrayBuffer} data - Input buffer.
 * @param {number} offset - Start of data.
 * @return Converted number.
 * @public
 */
function littleEndianToUint8(data, offset) {
	return data[offset]
}

})(); // End of closure for parseAdvertisementData.


/**
 * Returns a canonical UUID.
 *
 * Code adopted from the Bleat library by Rob Moran (@thegecko), see this file:
 * https://github.com/thegecko/bleat/blob/master/dist/bluetooth.helpers.js
 *
 * @param {string|number} uuid - The UUID to turn into canonical form.
 * @return Canonical UUID.
 */
exports.getCanonicalUUID = function(uuid) {
	if (typeof uuid === 'number') {
		uuid = uuid.toString(16);
	}

	uuid = uuid.toLowerCase();

	if (uuid.length <= 8) {
		uuid = ('00000000' + uuid).slice(-8) + '-0000-1000-8000-00805f9b34fb';
	}

	if (uuid.length === 32) {
		uuid = uuid
			.match(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/)
			.splice(1)
			.join('-');
	}

	return uuid;
};
