"use strict"

const logger = require('../logger');
const XMLHttpRequest = (process.env.NODE_ENV === 'test') ? require('../stubs').XMLHttpRequest : window.XMLHttpRequest;
const network = (process.env.NODE_ENV === 'test') ? require('../stubs').network : require('../utility').network;
const timeoutDuration = (process.env.NODE_ENV === 'test') ? 100 : 15000; // ms
const suspendPeriod = (process.env.NODE_ENV === 'test') ? 100 : 1000 * 60; // 1 minute
const maxQueueLength = (process.env.NODE_ENV === 'test') ? 5 : 500;

const ApiRequestDispatcher = function(baseURL) {
	this._queue = [];
	this._id = 0;
	this._dispatchSuspended = false;
	this._echoURL = baseURL;
	if (this._echoURL[this._echoURL.length-1] !== "/") this._echoURL += "/";
	this._echoURL += "device";

	if (typeof document !== "undefined") {
		// document won't exist when running tests outside a browser
		document.addEventListener("online", this._online.bind(this), false);
		document.addEventListener("offline", this._offline.bind(this), false);
		// Pauuse and resume are currenly ignored
		// document.addEventListener("pause", this._onPause.bind(this), false);
		// document.addEventListener("resume", this._onResume.bind(this), false);	
	}

	Object.defineProperty(this, "queueLength", { get: function() { return this._queue.length; } });
	Object.defineProperty(this, "queueEmpty", { get: function() { return this._queue.length === 0; } });
};

ApiRequestDispatcher.prototype.enqueue = function(request) {
	if (this._queue.length >= maxQueueLength) {
		logger.log("Dispatch queue too long - rejecting request.");
		request.callback(601, null);
		return null;
	}

	request._id = this._nextId();
	request._setTxTimeout(timeoutDuration, function(){this._onTxTimeout(request)}.bind(this));
	request._setOnError(function(){this._onError(request)}.bind(this));

	// How long is the queue allowed to get?
	this._queue.push(request);
	if (request.timeout) request._startTimeout(timeoutDuration, this._onTimeout.bind(this));
	this._dispatch();

	return request;
};

ApiRequestDispatcher.prototype._dispatch = function() {
	this._dispatchSuspended = this._dispatchSuspended || network.offline;
	if (this._dispatchSuspended) logger.log("Dispatch suspended, cannot dispatch (network: " + network.ConnectionType + ")");
	while (!this._dispatchSuspended && (this._queue.length > 0)) {
		let request = this._queue.shift();
		request._stopTimeout();
		request._send();
	}
};

// ApiRequestDispatcher.prototype._suspendDispatch = function() {
// 	if (this._dispatchSuspended) return;
// 	logger.log("Suspending dispatch.");
// 	this._dispatchSuspended = true;
// 	setTimeout(this._restartDispatch.bind(this), suspendPeriod);
// };

// ApiRequestDispatcher.prototype._restartDispatch = function() {
// 	if (!this._dispatchSuspended) return;
// 	logger.log("Restarting dispatch.");
// 	this._dispatchSuspended = false;
// 	this._dispatch();
// };

ApiRequestDispatcher.prototype._retry = function(request) {
	// Prepare the request for resending
	request._resetRequest();
	request._setTxTimeout(timeoutDuration, function(){this._onTxTimeout(request)}.bind(this));
	request._setOnError(function(){this._onError(request)}.bind(this));

	// This assumes that the value of the request id will always increase (which cannot happen)
	// However, with only one request being sent out every hour or so, the assumption is safe enough
	logger.log("Putting request with id", request.id, "back on the dispatcher queue.");

	// Put the event back on the queue
	// Add it to the front of the queue as that should be closest to its correct position 
	this._queue.unshift(request);

	// Re-sort the queue
	// Strictly speaking this is unnecessary but dispatching in order makes the date easier to read server-side
	this._queue.sort(function(a, b) {
		if (a.id < b.id) return -1;
		if (a.id > b.id) return 1;
		return 0;
	})

	if (request.timeout) request._startTimeout(timeoutDuration, this._onTimeout.bind(this));
	this._dispatch();
}

ApiRequestDispatcher.prototype.dequeue = function(request) {
	logger.log("Removing request with id", request.id, "from the dispatcher queue.");
	for (let i = 0; i < this._queue.length; i++) {
		if (this._queue[i].id === request.id) {
			this._queue[i]._stopTimeout();
			this._queue.splice(i, 1);
			break;
		}
	}
};

ApiRequestDispatcher.prototype._online = function() {
	logger.log("Online event received.");
	logger.log("Network connection type is:", network.connectionType + ".")
	if (this._dispatchSuspended && network.online) {
		// Stuff to send, let's see if it's possible
		const echoRequest = new XMLHttpRequest();
		const deviceId = (process.env.NODE_ENV === 'test') ? "test-uuid" : device.uuid;
		const url = this._echoURL + "/" + deviceId;
		echoRequest.open("GET", url);
		echoRequest.onload = function() {
		  if (echoRequest.status === 200) {
		  	logger.log("Echo request to", url, "succeeded.");
		  	this._dispatchSuspended = false;
		  	this._dispatch();
		  }
		}.bind(this);
		echoRequest.timeout = timeoutDuration;
		echoRequest.ontimeout = function() {
			logger.log("Echo request to", this._echoURL, "failed");
			setTimeout(this._online.bind(this), suspendPeriod);
		}.bind(this);
		echoRequest.onerror = function() {
			logger.log("Echo request to", this._echoURL, "failed");
			setTimeout(this._online.bind(this), suspendPeriod);
		}.bind(this);
		logger.log("Sending Echo request.")
		echoRequest.send();
	}
};

ApiRequestDispatcher.prototype._offline = function() {
	logger.log("Offline event received.");
	this._dispatchSuspended = true;
};

ApiRequestDispatcher.prototype._onTxTimeout = function(request) {
	// The request was sent but has not been acknowledged in time
	logger.log("Transmission timeout for request with id", request.id + ".");
	//this._suspendDispatch();
	if (request.timeout)
		request.callback(600, null);	
	else {
		// this._suspendDispatch();
		this._retry(request);
	}
};

ApiRequestDispatcher.prototype._onTimeout = function(request) {
	// The request has been sitting, unsent on the queue for too long and will now be removed
	logger.log("Timeout, ending request with id", request.id + ".");
	this.dequeue(request);
	request.callback(600, null);
};

ApiRequestDispatcher.prototype._onError = function(request) {
	// The request was sent but there has been a network level error
	// Prepare the request for resending
	logger.log("Network error sending request with id", request.id + ".");
	// this._suspendDispatch();
	this._retry(request);
}

ApiRequestDispatcher.prototype._nextId = function() {
	// MAX_SAFE_INTEGER === 9007199254740991
	// This equates to over 2 billion years of messages if sending one message every 10 seconds (which is realistic)
	// So don't really have to worry about the wrap around
	if (this._id === Number.MAX_SAFE_INTEGER) this._id = 0;
	this._id += 1;
	return this._id;
};

// ApiRequestDispatcher.prototype._queueToString = function() {
// 	let string = "";
// 	for (let i = 0; i < this._queue.length; i++) {
// 		string += this._queue[i].id.toString() + ", ";
// 	}
// 	return "[" + string.substring(0, string.length - 2) + "]";
// };

// Singleton
let _apiDispatcher = null;

const getSystemDispatcher = function() {
	// Create the singleton if it doesnt exist
	if (!_apiDispatcher) {
		const baseURL = (process.env.NODE_ENV === 'test') ? "https://cj101d.ifdnrg.com" : "https://c4a.etive.org:8443/api";
		_apiDispatcher = new ApiRequestDispatcher(baseURL);
	}
	return _apiDispatcher;
}

const setSystemDispatcher = function(baseURL) {
	// Create the singleton if it doesnt exist
	if (!_apiDispatcher) _apiDispatcher = new ApiRequestDispatcher(baseURL);
	return _apiDispatcher;
}

module.exports = {
	setSystemDispatcher: setSystemDispatcher,
	getSystemDispatcher: getSystemDispatcher
};