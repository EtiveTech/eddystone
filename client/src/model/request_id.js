"use strict"

let _nextRequestId = 0;

const RequestId = function() {
	// MAX_SAFE_INTEGER === 9007199254740991
	// This equates to over 2 billion years of messages if sending one message every 10 seconds (which is realistic)
	// So don't really have to worry about the wrap around
	if (_nextRequestId === Number.MAX_SAFE_INTEGER) _nextRequestId = 0;
	_nextRequestId += 1;
	this._id = _nextRequestId;
}

RequestId.prototype.greaterThan = function(another) {
	if ((this._id === 1) && (another._id === Number.MAX_SAFE_INTEGER)) return true;
	return (this._id > another._id);
};

RequestId.prototype.lessThan = function(another) {
	if ((this._id === Number.MAX_SAFE_INTEGER) && (another._id === 1)) return true;
	return (this._id < another._id);
};

RequestId.prototype.toString = function() {
	return this._id.toString();
}

module.exports = RequestId;