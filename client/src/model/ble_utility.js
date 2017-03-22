const base64 = cordova.require('cordova/base64');

const BLUETOOTH_BASE_UUID = '-0000-1000-8000-00805f9b34fb'

/**
 * Interpret byte buffer as unsigned little endian 8 bit integer.
 * Returns converted number.
 * @param {ArrayBuffer} data - Input buffer.
 * @param {number} offset - Start of data.
 * @return Converted number.
 * @public
 */
const littleToUint8 = function(data, offset) {
	return data[offset];
}

/**
 * Interpret byte buffer as little endian 8 bit integer.
 * Returns converted number.
 * @param {ArrayBuffer} data - Input buffer.
 * @param {number} offset - Start of data.
 * @return Converted number.
 * @public
 */
const littleToInt8 = function(data, offset) {
	let x = littleToUint8(data, offset);
	if (x & 0x80) x = x - 256;
	return x;
}

/**
 * Interpret byte buffer as little endian 16 bit integer.
 * Returns converted number.
 * @param {ArrayBuffer} data - Input buffer.
 * @param {number} offset - Start of data.
 * @return Converted number.
 * @public
 */
const littleToInt16 = function(data, offset){
	return (littleToInt8(data, offset + 1) << 8) + littleToUint8(data, offset);
}

/**
 * Interpret byte buffer as unsigned little endian 16 bit integer.
 * Returns converted number.
 * @param {ArrayBuffer} data - Input buffer.
 * @param {number} offset - Start of data.
 * @return Converted number.
 * @public
 */
const littleToUint16 = function(data, offset) {
	return (littleToUint8(data, offset + 1) << 8) + littleToUint8(data, offset);
}

/**
 * Interpret byte buffer as unsigned little endian 32 bit integer.
 * Returns converted number.
 * @param {ArrayBuffer} data - Input buffer.
 * @param {number} offset - Start of data.
 * @return Converted number.
 * @public
 */
const littleToUint32 = function(data, offset) {
	return (littleToUint8(data, offset + 3) << 24) + (littleToUint8(data, offset + 2) << 16) +
		(littleToUint8(data, offset + 1) << 8) + littleToUint8(data, offset);
}


/**
 * Interpret byte buffer as signed big endian 16 bit integer.
 * Returns converted number.
 * @param {ArrayBuffer} data - Input buffer.
 * @param {number} offset - Start of data.
 * @return Converted number.
 * @public
 */
const bigToInt16 = function(data, offset) {
	return (littleToInt8(data, offset) << 8) + littleToUint8(data, offset + 1)
}

/**
 * Interpret byte buffer as unsigned big endian 16 bit integer.
 * Returns converted number.
 * @param {ArrayBuffer} data - Input buffer.
 * @param {number} offset - Start of data.
 * @return Converted number.
 * @public
 */
const bigToUint16 = function(data, offset) {
	return (littleToUint8(data, offset) << 8) + littleToUint8(data, offset + 1)
}

/**
 * Interpret byte buffer as unsigned big endian 32 bit integer.
 * Returns converted number.
 * @param {ArrayBuffer} data - Input buffer.
 * @param {number} offset - Start of data.
 * @return Converted number.
 * @public
 */
const bigToUint32 = function(data, offset) {
	return (littleToUint8(data, offset) << 24) + (littleToUint8(data, offset + 1) << 16) +
		(littleToUint8(data, offset + 2) << 8) + littleToUint8(data, offset + 3)
}

/**
 * Converts a single Base64 character to a 6-bit integer.
 * @private
 */
const b64ToUint6 = function(nChr) {
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
 * Decodes a Base64 string. Returns a Uint8Array.
 * nBlocksSize is optional.
 * @param {String} sBase64
 * @param {int} nBlocksSize
 * @return {Uint8Array}
 * @public
 */
const base64DecToArr = function(sBase64, nBlocksSize) {
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

const toHexString = function(i, byteCount) {
	let string = (new Number(i)).toString(16);
	while(string.length < byteCount * 2) {
		string = '0' + string;
	}
	return string;
}

const arrayToUUID = function(array, offset)
{
	let k = 0;
	let string = '';
	const UUID_format = [4, 2, 2, 2, 6];
	for (let l = 0; l < UUID_format.length; l++) {
		if (l != 0) string += '-';
		for (var j=0; j < UUID_format[l]; j++, k++) {
			string += toHexString(array[offset+k], 1);
		}
	}
	return string;
}

const addAdvertisementData = function(device)
{

	// If device object already has advertisementData we
	// do not need to parse the scanRecord.
	if (device.advertisementData) return;

	// Must have scanRecord to continue.
	if (!device.scanRecord) return;

	// Here we parse BLE/GAP Scan Response Data.
	// See the Bluetooth Specification, v4.0, Volume 3, Part C, Section 11,
	// for details.

	let byteArray = base64DecToArr(device.scanRecord);
	let pos = 0;
	let advertisementData = {};
	let serviceUUIDs = [];
	let serviceData = {};

	// The scan record is a list of structures.
	// Each structure has a length byte, a type byte, and (length-1) data bytes.
	// The format of the data bytes depends on the type.
	// Malformed scanRecords will likely cause an exception in this function.

	while (pos < byteArray.length) {
		let uuid;
		let data;
		let length = byteArray[pos++];
		if (length == 0) break;
		length -= 1;
		// const type = byteArray[pos++];

		// Parse types we know and care about.
		// Skip other types.

		switch (byteArray[pos++]) {
			// Convert 16-byte Uint8Array to RFC-4122-formatted UUID.
			case 0x02:
			case 0x03:
				// 16-bit Service Class UUIDs.
				for(let i = 0; i < length; i += 2) {
					serviceUUIDs.push('0000' + toHexString(littleToUint16(byteArray, pos + i), 2) + BLUETOOTH_BASE_UUID);
				}
				break;

			case 0x04:
			case 0x05:
				// 32-bit Service Class UUIDs.
				for (let i = 0; i < length; i += 4) {
					serviceUUIDs.push(toHexString(littleToUint32(byteArray, pos + i), 4) + BLUETOOTH_BASE_UUID);
				}
				break;

			case 0x06:
			case 0x07:
				// 128-bit Service Class UUIDs.
				for (let i = 0; i < length; i += 16) {
					serviceUUIDs.push(arrayToUUID(byteArray, pos + i));
				}
				break;

			case 0x08:
			case 0x09:
				// Local Name.
				advertisementData.kCBAdvDataLocalName = evothings.ble.fromUtf8(
					new Uint8Array(byteArray.buffer, pos, length));
				break;

			case 0x0a:
				// TX Power Level.
				advertisementData.kCBAdvDataTxPowerLevel = littleToInt8(byteArray, pos);
				break;

			case 0x16:
				// Service Data, 16-bit UUID.
				uuid = '0000' + toHexString(littleToUint16(byteArray, pos), 2) + BLUETOOTH_BASE_UUID;
				data = new Uint8Array(byteArray.buffer, pos + 2, length - 2);
				serviceData[uuid] = base64.fromArrayBuffer(data);
				break;

			case 0x20:
				// Service Data, 32-bit UUID.
				uuid = toHexString(littleToUint32(byteArray, pos), 4) + BLUETOOTH_BASE_UUID;
				data = new Uint8Array(byteArray.buffer, pos + 4, length - 4);
				serviceData[uuid] = base64.fromArrayBuffer(data);
				break;

			case 0x21:
				// Service Data, 128-bit UUID.
				uuid = arrayToUUID(byteArray, pos);
				data = new Uint8Array(byteArray.buffer, pos+16, length-16);
				serviceData[uuid] = base64.fromArrayBuffer(data);
				break;

			case 0xff:
				// Manufacturer-specific Data.
				// Annoying to have to transform base64 back and forth,
				// but it has to be done in order to maintain the API.
				advertisementData.kCBAdvDataManufacturerData =
					base64.fromArrayBuffer(new Uint8Array(byteArray.buffer, pos, length));
				break;
		}
		pos += length;
	}
	advertisementData.kCBAdvDataServiceUUIDs = (serviceUUIDs.length > 0) ? serviceUUIDs : null;
	advertisementData.kCBAdvDataServiceData = (Object.keys(serviceData).length > 0) ? serviceData : null;
	device.advertisementData = advertisementData;
}

// Return true on frame type recognition, false otherwise.
const parseFrameUID = function(device, data, win, fail) {
	if(data[0] != 0x00);

	// The UID frame has 18 bytes + 2 bytes reserved for future use
	// https://github.com/google/eddystone/tree/master/eddystone-uid
	// Check that we got at least 18 bytes.
	if(data.byteLength < 18) {
		fail("UID frame: invalid byteLength: " + data.byteLength);
		return;
	}

	device.txPower = evothings.util.littleEndianToInt8(data, 1);
	device.nid = data.subarray(2, 12);  // Namespace ID.
	device.bid = data.subarray(12, 18); // Beacon ID.
}

const parseFrameEID = function(device, data, onError) {
  if(data[0] != 0x30) return;

  if(data.byteLength < 10) {
    onError("EID frame: invalid byteLength: "+data.byteLength);
    return;
  }

  device.txPower = evothings.util.littleToInt8(data, 1);
  device.eid = data.subarray(2, 9);  // EID.
}

const parseFrameURL = function(device, data, onError) {
	if(data[0] != 0x10) return;

	if(data.byteLength < 4) {
		onError("URL frame: invalid byteLength: " + data.byteLength);
		return;
	}

	device.txPower = littleToInt8(data, 1);

	// URL scheme prefix
	let url;
	switch(data[2]) {
		case 0: url = 'http://www.'; break;
		case 1: url = 'https://www.'; break;
		case 2: url = 'http://'; break;
		case 3: url = 'https://'; break;
		default: onError("URL frame: invalid prefix: " + data[2]); return;
	}

	// Process each byte in sequence.
	for (let i = 3; i < data.byteLength; i++) {
		const c = data[i];
		// A byte is either a top-domain shortcut, or a printable ascii character.
		if(c < 14) {
			switch(c) {
				case 0: url += '.com/'; break;
				case 1: url += '.org/'; break;
				case 2: url += '.edu/'; break;
				case 3: url += '.net/'; break;
				case 4: url += '.info/'; break;
				case 5: url += '.biz/'; break;
				case 6: url += '.gov/'; break;
				case 7: url += '.com'; break;
				case 8: url += '.org'; break;
				case 9: url += '.edu'; break;
				case 10: url += '.net'; break;
				case 11: url += '.info'; break;
				case 12: url += '.biz'; break;
				case 13: url += '.gov'; break;
			}
		}
		else if(c < 32 || c >= 127) {
			// Unprintables are not allowed.
			onError("URL frame: invalid character: " + data[2]);
			return;
		}
		else {
			url += String.fromCharCode(c);
		}
	}

	// Set URL field of the device.
	device.url = url;
}

const parseFrameTLM = function(device, data, onError) {
	if(data[0] != 0x20) return false;

	if(data[1] != 0x00) {
		onError("TLM frame: unknown version: " + data[1]);
		return;
	}

	if(data.byteLength != 14) {
		onError("TLM frame: invalid byteLength: " + data.byteLength);
		return;
	}

	device.voltage = bigToUint16(data, 2);
	device.temperature = (bigToUint16(data, 4) === 0x800) ? 0x8000 : bigEndianToInt16(data, 4) / 256.0;
	device.adv_cnt = bigEndianToUint32(data, 6);
	device.dsec_cnt = bigEndianToUint32(data, 10);
}

module.exports = {
	addAdvertisementData: addAdvertisementData,
	base64DecToArr: base64DecToArr,
	parseFrameUID: parseFrameUID,
	parseFrameEID: parseFrameEID,
	parseFrameURL: parseFrameURL,
	parseFrameTLM: parseFrameTLM
};