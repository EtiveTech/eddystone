"use strict"

const Request = require('./api_request');
const apiKey = require('../keys').localRepository;
const logger = require('../utility').logger;
const arrayToHex = require('../utility').arrayToHex;
const localStorage = (process.env.NODE_ENV === 'test') ? require("../stubs").localStorage : window.localStorage;
const defaultHelloInterval = 60 * 60 * 1000;
const tokenKey = "token";
const beaconLog = "api/event";
const authorize = "api/receiver";

const Repository = function(baseURL, interval) {
	this._baseURL = baseURL;
	if (this._baseURL[this._baseURL.length-1] !== "/") this._baseURL += "/";
	this._token = localStorage.getItem(tokenKey);
	this._interval = (interval) ? interval : defaultHelloInterval;
	this._timer = this._startTimer();
};

Repository.prototype._startTimer = function() {
	if (this._token && this._interval > 0) return setInterval(this.hello.bind(this), this._interval);
	return null;  	
};

Repository.prototype._stopTimer = function() {
	// This method intended to clear down tests
	if (this._timer) clearInterval(this._timer);
};

Repository.prototype.authorize = function(emailAddress, onCompleted) {
	logger("Sending authorisation request")
	const request = new Request();
	let url = this._baseURL + authorize;
	url += 	"/" + encodeURIComponent(emailAddress) + "?key=" + encodeURIComponent(apiKey);

	request.makeGetRequest(url, true, function(status, response) {
		if (status === 200 && response.token) {
			this._token = response.token;
    	localStorage.setItem(tokenKey, this._token);
		  this._timer = this._startTimer();	
		}
	  if (onCompleted) {
	  	const message = (response) ? response.message : null;
	  	onCompleted(status === 200, message);
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
		token: this._token
	}
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
		token: this._token
	}
	request.makePostRequest(this._baseURL + beaconLog, content, false, function(status) {
		// Might not be authorised to send to the server or the api key may be wrong
		if (onCompleted) onCompleted(status);
	});
}

Repository.prototype.hello = function (onCompleted) {
	if (!this._token) return;
	logger("Sending hello message")
	const request = new Request();
	const content = {
		eventType: 'hello',
		timestamp: Date.now(),
		token: this._token
	}
	request.makePostRequest(this._baseURL + beaconLog, content, false, function(status) {
		// Might not be authorised to send to the server or the api key may be wrong
		if (onCompleted) onCompleted(status);
	});
}

module.exports = Repository;