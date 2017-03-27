const Request = require('./api_request');
const apiKey = require('../keys').localRepository;
const logger = require('../utility').logger;
const arrayToHex = require('../model/ble_utility').arrayToHexString;
const beaconLog = "beacon-log";

const Repository = function(baseURL, emailAddress) {
	this._baseURL = baseURL + "/";
	this._emailAddress = emailAddress;
}

Repository.prototype.foundBeacon = function(beacon) {
	const request = new Request();
	const content = {
		messageType: 'found',
		datetime: new Date().toISOString(),
		beaconId: arrayToHex(beacon.bid),
		address: beacon.address,
		RSSI: beacon.rssi,
		txPower: beacon.txPower,
		email: this._emailAddress,
		key: apiKey
	}
	request.makePostRequest(this._baseURL + beaconLog, content, function(status) {
		// Might not be authorised to send to the server or the api key may be wrong
	});
}

Repository.prototype.lostBeacon = function (beacon) {
	const request = new Request();
	const content = {
		messageType: 'lost',
		datetime: new Date().toISOString(),
		beaconId: arrayToHex(beacon.bid),
		address: beacon.address,
		RSSI: beacon.rssi,
		maxRSSI: beacon.rssiMax,
		email: this._emailAddress,
		key: apiKey
	}
	request.makePostRequest(this._baseURL + beaconLog, content, function(status) {
		// Might not be authorised to send to the server or the api key may be wrong
	});
}

module.exports = Repository;