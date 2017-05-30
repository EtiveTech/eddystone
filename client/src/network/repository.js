"use strict"

const Request = require('./api_request');
const apiKey = require('../keys').localRepository;
const logger = require('../utility').logger;
const arrayToHex = require('../utility').arrayToHex;
const localStorage = (process.env.NODE_ENV === 'test') ? require("../stubs").localStorage : window.localStorage;
const defaultHeartbeatInterval = ((process.env.NODE_ENV === 'test') ? 1 : 30) * 60 * 1000;
const regionInterval = ((process.env.NODE_ENV === 'test') ? 1 : 1440) * 60 * 1000;

const tokenKey = "token";
const regionsKey = "regions";
const beaconRoute = "proximity";
const authorizeRoute = "receiver";
const deviceRoute = "device";
const regionRoute = "region";

const Repository = function(baseURL, interval) {
	this._baseURL = baseURL;
	if (this._baseURL[this._baseURL.length-1] !== "/") this._baseURL += "/";
	
	this._token = localStorage.getItem(tokenKey);
	let regions = localStorage.getItem(regionsKey);
	this._regions = (regions) ? JSON.parse(regions) : null;

	// Try and start the timers. Will fail if there is no token
	this._hearbeatInterval = (interval) ? interval : defaultHeartbeatInterval;
	this._heartbeatTimer = this._regionTimer = null;
	this._startTimers();

	this._beaconCount = 0; // For debug
	
	Object.defineProperty(this, "hasToken", { get: function() { return (this._token) ? true : false; } });
	Object.defineProperty(this, "regions", { get: function() { return this._regions.regions; } });
	Object.defineProperty(this, "knownBeaconCount", { get: function() {
		return "(there " + ((this._beaconCount === 1) ? "is " : "are ") +
	  	this._beaconCount + ((this._beaconCount === 1) ? " beacon" : " beacons") + " in range)";
	} });
};

Repository.prototype._startTimers = function(issueHearbeat) {
	if (this._token) {
		if (this._hearbeatInterval > 0) {
			if (issueHearbeat) this.heartbeat();
			this._heartbeatTimer = setInterval(this.heartbeat.bind(this), this._hearbeatInterval);
		}
		this._fetchRegions();
		if (regionInterval > 0) this._regionTimer = setInterval(this._fetchRegions.bind(this), regionInterval);
	}

	return null;  	
};

Repository.prototype.authorize = function(emailAddress, onCompleted) {
	logger("Sending authorisation request for", emailAddress);
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
				  this._heartbeatTimer = this._startHeartbeat(false);
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
	this._beaconCount += 1;
	logger("Sending found beacon message for", arrayToHex(beacon.bid), this.knownBeaconCount);
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
	request.makePostRequest(this._baseURL + beaconRoute, content, false, function(status) {
		// Might not be authorised to send to the server or the api key may be wrong
		if (onCompleted) onCompleted(status);
	});
}

Repository.prototype.lostBeacon = function (beacon, onCompleted) {
	if (!this._token) return;

	this._beaconCount -= 1;

	if (!beacon.confirmed){
		logger("Lost contact with unconfirmed beacon", arrayToHex(beacon.bid), this.knownBeaconCount);
		// Don't bother reporting the loss to the server - it doesn't know about it
		return;
	}
	
	logger("Sending lost beacon message for", arrayToHex(beacon.bid), this.knownBeaconCount);
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
	request.makePostRequest(this._baseURL + beaconRoute, content, false, function(status) {
		// Might not be authorised to send to the server or the api key may be wrong
		if (onCompleted) onCompleted(status);
	});
}

Repository.prototype.heartbeat = function(onCompleted) {
	if (!this._token) return;
	logger("Sending heartbeat message")
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

Repository.prototype._fetchRegions = function() {
	logger("Sending region request");
	const regionRequest = new Request();
	let url = this._baseURL + regionRoute;

	if (this._regions) url += "?stamp=" + this._regions.changed;
	regionRequest.makeGetRequest(url, false, function(status, response) {
		if (status === 200) {
			this._regions = response;
			localStorage.setItem(regionsKey, JSON.stringify(this._regions));
		}
	}.bind(this))
}

module.exports = Repository;