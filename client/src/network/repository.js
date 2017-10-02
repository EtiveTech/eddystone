"use strict"

const Request = require('./api_request');
const EventFactory = require('./event_factory')
const apiKey = require('../keys').localRepository;
const logger = require('../utility').logger;
const arrayToHex = require('../utility').arrayToHex;
const localStorage = (process.env.NODE_ENV === 'test') ? require("../stubs").localStorage : window.localStorage;
const defaultHeartbeatInterval = ((process.env.NODE_ENV === 'test') ? 1 : 60 * 60) * 1000;
const regionInterval = ((process.env.NODE_ENV === 'test') ? 10 : 24 * 60 * 60) * 1000;

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
	const regions = localStorage.getItem(regionsKey);
	this._regions = (regions) ? JSON.parse(regions) : null;

	// Try and start the timers. Will fail if there is no token
	this._heartbeatInterval = (interval) ? interval : defaultHeartbeatInterval;
	this._heartbeatTimerID = null;
	this._regionTimerID = null;
	this._eventFactory = (this._token) ? new EventFactory(this._baseURL, this._token) : null;
	this._startTimers(true);

	this._beaconCount = 0; // For debug
	
	Object.defineProperty(this, "hasToken", { get: function() { return (this._token) ? true : false; } });
	Object.defineProperty(this, "regions", { get: function() { return this._regions.regions; } });
	Object.defineProperty(this, "knownBeaconCount", { get: function() {
		return "(there " + ((this._beaconCount === 1) ? "is " : "are ") +
	  	this._beaconCount + ((this._beaconCount === 1) ? " beacon" : " beacons") + " in range)";
	} });
};

Repository.prototype._startTimers = function(issueHeartbeat) {
	if (this._token) {
		logger("Repository starting timers")
		if (this._heartbeatInterval > 0) {
			if (issueHeartbeat) this.heartbeat();
			this._heartbeatTimerID = setInterval(this.heartbeat.bind(this), this._heartbeatInterval);
		}
		this._fetchRegions();
		if (regionInterval > 0) this._regionTimerID = setInterval(this._fetchRegions.bind(this), regionInterval);
	};	
};

Repository.prototype._stopTimers = function() {
	// Used by tests
	let count = 0;

	if (this._heartbeatTimerID) {
		clearInterval(this._heartbeatTimerID);
		this._heartbeatTimerID = null;
		count += 1;
	}

	if (this._regionTimerID) {
		clearInterval(this._regionTimerID);
		this._regionTimerID = null;
		count += 1;
	}

	logger("Repository stopped", count, "timers.");
	return count;
}

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
		    	this._eventFactory = new EventFactory(this._baseURL, this._token);
				  this._startTimers(false);
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
	this._eventFactory.foundBeaconEvent(beacon, onCompleted)
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
	this._eventFactory.lostBeaconEvent(beacon, onCompleted)
}

Repository.prototype.heartbeat = function(onCompleted) {
	if (!this._token) return;
	logger("Sending heartbeat message")
	this._eventFactory.heartbeatEvent(onCompleted)
}

Repository.prototype._fetchRegions = function() {
	if (!this._token) return;
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