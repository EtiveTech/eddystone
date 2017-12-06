"use strict"

const logger = require('../logger');
const _accelerometerWatchInterval = 1000;
const _geolocationTimeout = 7500;

const Location = function(onStopped, onMoving, onError) {
	this._onStopped = onStopped;
	this._onMoving = onMoving;
	this._onError = function(error) { onError(error.message); };
	this._lastAccelerometerReading = null;
	this._watchId = null;
	this._isMoving = null;
	this._wasMoving = null;
	this._ticksBetweenResponses = null;
	this._ticks = null;
}

Location.prototype._reportMovement = function(isMoving, wasMoving) {

	function logPosition(state, position) {
		logger.log("Device", state, "at lat:", position.latitude, "lng:", position.longitude, "(accuracy:", position.accuracy + ")");
	}

	function onSuccess(position, moving) {
		if (moving) {
			logPosition("moving", position.coords);
			this._onMoving(position.coords);
		}
		else {
			logPosition("stopped", position.coords);
			this._onStopped(position.coords);
		}
	}

	logger.log("Reporting movement: isMoving =", isMoving, "wasMoving =", wasMoving);

	if (isMoving || wasMoving) {
		navigator.geolocation.getCurrentPosition(
			function(position) { onSuccess.call(this, position, isMoving); }.bind(this),
			this._onError,
			{ maximumAge: 3000, timeout: _geolocationTimeout, enableHighAccuracy: false }
		)
	}
}

Location.prototype._onSuccess = function(accelerometerReading) {
	// This method will look at the x and y properties of acceleratio and determine if the device is moving
	// Ignoring the z (vertical) property because don't need to know about altitude
	// If the device is moving now but wasn't before then call this._onMoving()
	// If the device is stationary now but was moving before then call this._onStopped()
	// If this._startup is true call whichever callback is appropriate based on the accelerometer value only

	function stateChanged(oldState, newState) {

		function equal(number1, number2) {
			return (Math.abs(number1 - number2) <= 0.1);
		}

		const result = !(equal(oldState.x, newState.x) && equal(oldState.y, newState.y) && equal(oldState.z, newState.z));
		// logger.log("stateChanged(" + oldState + ", " + newState + ") = " + result)
		return result;
	}

	const moving = (this._lastAccelerometerReading) ? stateChanged(this._lastAccelerometerReading, accelerometerReading) : false;
	this._ticks += 1;
	logger.log(this._ticks, ". Accelerometer: x =", accelerometerReading.x, "y =", accelerometerReading.y, "z =", accelerometerReading.z, "(moving =" + moving + ")");
	this._lastAccelerometerReading = accelerometerReading;
	// logger.log("_isMoving =", this._isMoving, "moving =", moving);
	this._isMoving = this._isMoving || moving;
	if (this._ticks >= this._ticksBetweenResponses) {
		const wasMoving = this._wasMoving;
		const isMoving = this._isMoving;
		this._wasMoving = this._isMoving;
		this._isMoving = false;
		this._ticks = 0;
		// Do this last as a reschedule will happen when getCurrentPosition is called
		this._reportMovement(isMoving, wasMoving);
	}
}

Location.prototype.start = function(ticks) {
	if (!this._watchId) {
		logger.log("Geolocation starting");

		this._ticksBetweenResponses = ticks;

		this._isMoving = false;
		this._wasMoving = false;
		this._ticks = 0;

		const options = { frequency: _accelerometerWatchInterval };
		this._watchId = navigator.accelerometer.watchAcceleration(this._onSuccess.bind(this), this._onError, options);
		this._reportMovement(false, true);
		return true;
	}
	return false;
}

Location.prototype.stop = function() {
	if (this._watchId) {
		navigator.accelerometer.clearWatch(this._watchId);
		this._watchId = null;
	}
	logger.log("Geolocation stopped");
}

Location.prototype.changeInterval = function(ticks) {
	this._ticksBetweenResponses = ticks;
	logger.log("Reporting inverval changed to", ticks, "ticks");
}

module.exports = Location;
