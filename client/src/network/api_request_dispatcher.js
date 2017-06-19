"use strict"

const logger = require('../utility').logger;
const network = (process.env.NODE_ENV === 'test') ? require('../stubs').network : require('../utility').network;
const timeoutDuration = (process.env.NODE_ENV === 'test') ? 100 : 15000; // ms
const suspendPeriod = (process.env.NODE_ENV === 'test') ? 1000 : 2 * 60 * 1000; // 2 minutes
const maxQueueLength = (process.env.NODE_ENV === 'test') ? 5 : 500;

const ApiRequestDispatcher = function() {
	this._queue = [];
	this._id = 0;
	this._dispatchSuspended = false;

	if (typeof document !== "undefined") {
		// document won't exist when running tests outside a browser
		document.addEventListener("online", this._online.bind(this), false);
		// Pauuse and resume are currenly ignored
		// document.addEventListener("pause", this._onPause.bind(this), false);
		// document.addEventListener("resume", this._onResume.bind(this), false);	
	}
};

ApiRequestDispatcher.prototype.enqueue = function(request) {
	if (this._queue.length >= maxQueueLength) {
		logger("Dispatch queue too long - rejecting request.");
		request.callback(601, null);
		return null;
	}

	request._id = this._nextId();
	request._setTxTimeout(timeoutDuration, function(){this._onTxTimeout(request)}.bind(this));
	request._setOnError(function(){this._onError(request)}.bind(this));

	logger("Adding request with id", request.id, "to the dispatcher queue.");
	// How long is the queue allowed to get?
	this._queue.push(request);
	if (request.timeout) request._startTimeout(timeoutDuration, this._onTimeout.bind(this));
	this._dispatch();

	return request;
};

ApiRequestDispatcher.prototype._dispatch = function() {
	// If the network is offline, no messages should be sent until the newtwork is online
	// If an attempt to send has timed out or has generated a network error then dispatch should be
	// suspended to give the problem a chance to clear.
	while (network.online && !this._dispatchSuspended && (this._queue.length > 0)) {
		let request = this._queue.shift();
		request._stopTimeout();
		logger("Sending request with id", request.id + ".");
		request._send();
	}
};

ApiRequestDispatcher.prototype._suspendDispatch = function() {
	logger("Suspending dispatch.");
	this._dispatchSuspended = true;
	setTimeout(this._restartDispatch.bind(this), suspendPeriod);
};

ApiRequestDispatcher.prototype._restartDispatch = function() {
	logger("Restarting dispatch.");
	this._dispatchSuspended = false;
	this._dispatch();
};

ApiRequestDispatcher.prototype._retry = function(request) {
	// Prepare the request for resending
	request._resetRequest();
	request._setTxTimeout(timeoutDuration, function(){this._onTxTimeout(request)}.bind(this));
	request._setOnError(function(){this._onError(request)}.bind(this));

	// This assumes that the value of the request id will always increase (which cannot happen)
	// However, with only one request being sent out every hour or so, the assumption is safe enough
	logger("Putting request with id", request.id, "back on the dispatcher queue.");
	// Find the first queued request with an id greater than request id ainsert the request before it.
	const i = this._queue.findIndex(function(queued) {
		return queued.id > request.id
	})
	if (i < 0)
		this._queue.push(request);
	else
		this._queue.splice(i, 0, request);

	if (request.timeout) request._startTimeout(timeoutDuration, this._onTimeout.bind(this));
	this._dispatch();
}

ApiRequestDispatcher.prototype._dequeue = function(request) {
	logger("Removing request with id", request.id, "from the dispatcher queue.");
	for (let i = 0; i < this._queue.length; i++) {
		if (this._queue[i].id === request.id) {
			this._queue.splice(i, 1);
			break;
		}
	}
};

ApiRequestDispatcher.prototype._online = function() {
	logger("Online event received.");
	this._dispatch();
};

ApiRequestDispatcher.prototype._onTxTimeout = function(request) {
	// The request was sent but has not been acknowledged in time
	logger("Transmission timeout for request with id", request.id +".");
	//this._suspendDispatch();
	if (request.timeout)
		request.callback(600, null);	
	else {
		this._suspendDispatch();
		this._retry(request);
	}
};

ApiRequestDispatcher.prototype._onTimeout = function(request) {
	// The request has been sitting, unsent on the queue for too long and will now be removed
	logger("Timeout, ending request with id", request.id + ".");
	this._dequeue(request);
	request.callback(600, null);
};

ApiRequestDispatcher.prototype._onError = function(request) {
	// The request was sent but there has been a network level error
	// Prepare the request for resending
	logger("Network error sending request with id", request.id + ".");
	this._suspendDispatch();
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

let dispatcher = new ApiRequestDispatcher();	// A singleton

module.exports = dispatcher;