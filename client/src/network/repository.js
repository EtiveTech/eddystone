"use strict"

const Request = require('./api_request');
const apiKey = require('../keys').localRepository;
const logger = require('../utility').logger;
const arrayToHex = require('../utility').arrayToHex;
const localStorage = (process.env.NODE_ENV === 'test') ? require("../stubs").localStorage : window.localStorage;
const defaultHeartbeatInterval = ((process.env.NODE_ENV === 'test') ? 1 : 15) * 60 * 1000;
const tokenKey = "token";
const beaconLog = "proximity";
const authorizeRoute = "receiver";
const deviceRoute = "device"

const Repository = function(baseURL, interval) {
	logger("Initialising Repository at", baseURL)
	this._baseURL = baseURL;
	if (this._baseURL[this._baseURL.length-1] !== "/") this._baseURL += "/";
	this._token = localStorage.getItem(tokenKey);
	this._interval = (interval) ? interval : defaultHeartbeatInterval;
  // Try and start the timer. It will fail if there is no token
	this._timer = this._startTimer(true);
	
	Object.defineProperty(this, "hasToken", { get: function() { return (this._token) ? true : false; } });
};

Repository.prototype._startTimer = function(issueNow) {
	if (this._token && this._interval > 0) {
		if (issueNow) this.heartBeat();
		return setInterval(this.heartBeat.bind(this), this._interval);
	}
	return null;  	
};

Repository.prototype._stopTimer = function() {
	// This method intended to clear down tests
	if (this._timer) clearInterval(this._timer);
};

Repository.prototype.authorize = function(emailAddress, onCompleted) {
	logger("Sending authorisation request")
	const authorizeRequest = new Request();
	let url = this._baseURL + authorizeRoute;
	url += 	"/" + encodeURIComponent(emailAddress) + "?key=" + encodeURIComponent(apiKey);

	authorizeRequest.makeGetRequest(url, true, function(status, response) {
		if (status === 200 && response.token) {
			this._token = response.token;
			// The following test code should be removed when minified
			// device is not defined in a test environment
			const content = (process.env.NODE_ENV === 'test') ?
				{ os: "Test OS", osVersion: "Test Version", model: "Test Model", uuid: "Test UUID", token: this._token } :
				{
					os: device.platform,
					osVersion: device.version,
					model: device.model,
					timestamp: Date.now(),
					uuid: device.uuid,
					token: this._token
				};
			const deviceRequest = new Request();
			deviceRequest.makePostRequest(this._baseURL + deviceRoute, content, true, function(status, response) {
				if (status === 201) {
					// Everything is okay so persist the token and start the timer
		    	localStorage.setItem(tokenKey, this._token);
				  this._timer = this._startTimer(false);
				}
				else {
					// Couldn't save the device info so forget the token
					this._token = null;
				}
				if (onCompleted) onCompleted(status === 201, (response) ? response.message : null);
			}.bind(this))
		}
		else {
			// The GET failed
			if (onCompleted) onCompleted(false, (response) ? response.message : null);
		}
	}.bind(this));
}

Repository.prototype.foundBeacon = function(beacon, onCompleted) {
	if (!this._token) return;
	logger("Sending found beacon message");
	const request = new Request();
	const content = {
		eventType: 'found',
		timestamp: Date.now(),
		beaconId: arrayToHex(beacon.bid),
		address: beacon.address,
		rssi: beacon.rssi,
		txPower: beacon.txPower,
		uuid: (process.env.NODE_ENV === 'test') ? "Test UUID" : device.uuid,
		token: this._token
	}
	// Beacon events are not allowed to time out
	request.makePostRequest(this._baseURL + beaconLog, content, false, function(status) {
		// Might not be authorised to send to the server or the api key may be wrong
		if (onCompleted) onCompleted(status);
	});
}

Repository.prototype.lostBeacon = function (beacon, onCompleted) {
	if (!this._token) return;
	logger("Sending lost beacon message");
	const request = new Request();
	const content = {
		eventType: 'lost',
		timestamp: Date.now(),
		beaconId: arrayToHex(beacon.bid),
		address: beacon.address,
		rssi: beacon.rssi,
		rssiMax: beacon.rssiMax,
		uuid: (process.env.NODE_ENV === 'test') ? "Test UUID" : device.uuid,
		token: this._token
	}
	// Beacon events are not allowed to time out
	request.makePostRequest(this._baseURL + beaconLog, content, false, function(status) {
		// Might not be authorised to send to the server or the api key may be wrong
		if (onCompleted) onCompleted(status);
	});
}

Repository.prototype.heartBeat = function (onCompleted) {
	if (!this._token) return;
	logger("Sending heartBeat message")
	const request = new Request();
	const content = {
		timestamp: Date.now(),
		token: this._token
	}
	const uuid = (process.env.NODE_ENV === 'test') ? "test-uuid" : device.uuid;
	// Let heartbeat requests timeout if not sent. They are sent a few times every hour. No point in stock-piling
	request.makePutRequest(this._baseURL + deviceRoute + "/" + uuid, content, true, function(status) {
		// Might not be authorised to send to the server or the api key may be wrong
		if (onCompleted) onCompleted(status);
	});
}

module.exports = Repository;