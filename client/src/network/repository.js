const Request = require('./api_request');
const apiKey = require('../keys').localRepository;
const logger = require('../utility').logger;
const arrayToHex = require('../utility').arrayToHex;
const localStorage = (process.env.NODE_ENV === 'test') ? require("../stubs").localStorage : window.localStorage;
const helloInterval = 60 * 60 * 1000;
const tokenKey = "token";
const beaconLog = "beacon-log";
const authorise = "authorize";

const Repository = function(baseURL) {
	this._baseURL = baseURL + "/";
	this._token = localStorage.getItem(tokenKey);
	this._timer = setInterval(this.hello, helloInterval);
}

Repository.prototype.authorize = function(emailAddress, onCompleted) {
	const request = new Request();
	const content = {
		email: emailAddress,
		key: apiKey
	};
	request.makePostRequest(this._baseURL + authorise, content, true, function(status, token) {
		if (status === 201) {
			this._token = token;
    	localStorage.setItem(tokenKey, token);			
		}
	  if (onCompleted) onCompleted(status);
	});
}

Repository.prototype.foundBeacon = function(beacon, onCompleted) {
	const request = new Request();
	const content = {
		type: 'found',
		datetime: new Date().toISOString(),
		beaconId: arrayToHex(beacon.bid),
		address: beacon.address,
		RSSI: beacon.rssi,
		txPower: beacon.txPower,
		token: this._token
	}
	request.makePostRequest(this._baseURL + beaconLog, content, false, function(status) {
		// Might not be authorised to send to the server or the api key may be wrong
		if (onCompleted) onCompleted(status);
	});
}

Repository.prototype.lostBeacon = function (beacon, onCompleted) {
	const request = new Request();
	const content = {
		type: 'lost',
		datetime: new Date().toISOString(),
		beaconId: arrayToHex(beacon.bid),
		address: beacon.address,
		RSSI: beacon.rssi,
		maxRSSI: beacon.rssiMax,
		token: this._token
	}
	request.makePostRequest(this._baseURL + beaconLog, content, false, function(status) {
		// Might not be authorised to send to the server or the api key may be wrong
		if (onCompleted) onCompleted(status);
	});
}

Repository.prototype.hello = function () {
	const request = new Request();
	const content = {
		type: 'hello',
		datetime: new Date().toISOString(),
		token: this._token
	}
	request.makePostRequest(this._baseURL + beaconLog, content, false, function(status) {
		// Might not be authorised to send to the server or the api key may be wrong
		if (onCompleted) onCompleted(status);
	});
}

module.exports = Repository;