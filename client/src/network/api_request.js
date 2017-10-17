"use strict"

const logger = require('../utility').logger;
const dispatcher = require('./api_request_dispatcher');
const XMLHttpRequest = (process.env.NODE_ENV === 'test') ? require('../stubs').XMLHttpRequest : window.XMLHttpRequest;

const ApiRequest = function() {
  this._request = new XMLHttpRequest();
  this._options = null;
  this._json = null;
  this._timeoutID = null;
  this._id = 0;
  this._tries = 0;
  this._dispatcher = null;

  Object.defineProperty(this, "timeout", { get: function() { return this._options.timeout; } });
  Object.defineProperty(this, "callback", { get: function() { return this._options.callback; } });
  Object.defineProperty(this, "status", { get: function() { return this._status; } });
  Object.defineProperty(this, "id", { get: function() { return this._id; } });
  Object.defineProperty(this, "options", { get: function() { return this._options; } });
  Object.defineProperty(this, "retries", { get: function() { return (this._tries > 0) ? this._tries - 1 : 0; } });
};

ApiRequest.prototype._setRequest = function(options) {
  this._request.open(options.verb, options.url);
  if (options.jwt) this._request.setRequestHeader('Authorization', 'Bearer ' + options.jwt);
  if (options.content) {
    this._request.setRequestHeader('Content-Type', 'application/json');
    this._json = JSON.stringify(options.content);
  }

  this._request.onload = function() {
    // In the callback, 'this' is the request
    const req = this._request;
    let errorStatus = (options.expected.indexOf(req.status) === -1);
    let content = ((req.status === 204) || errorStatus ) ? null : JSON.parse(req.responseText);
    logger( options.verb + " request (" + this._id + ") to " + options.url + " returned status " + req.status);
    options.callback(req.status, content);
  }.bind(this);
};

ApiRequest.prototype._resetRequest = function() {
  if (!this._options) return null;
  this._request = new XMLHttpRequest();
  logger("Resetting " + this._options.verb + " request (" + this._id + ") to " + this._options.url + ".");
  this._setRequest(this._options);
  return this;
};

ApiRequest.prototype.makeRequest = function(options) {
  this._options = options;
  this._setRequest(options);
  const request = dispatcher.enqueue(this);
  logger( options.verb + " request (" + this._id + ") to " + options.url + " given to the dispatcher.");
  return request;
};

ApiRequest.prototype._send = function() {
  this._tries += 1;
  this._request.send(this._json);
};

ApiRequest.prototype._startTimeout = function(duration, callback) {
  if (this.timeout) this._timeoutID = setTimeout(callback, duration, this);
};

ApiRequest.prototype._stopTimeout = function() {
  if (this._timeoutID) clearTimeout(this._timeoutID);
  this._timeoutID = null;
};

ApiRequest.prototype._setTxTimeout = function(duration, callback) {
  this._request.timeout = duration;
  this._request.ontimeout = function() {
    callback(this);
  }.bind(this);
};

ApiRequest.prototype._setOnError = function(callback) {
  this._request.onerror = function() {
    callback(this);
  }.bind(this);
};

ApiRequest.prototype.makeGetRequest = function(url, timeout, callback) {
  const options = {
    verb: "GET",
    url: url,
    content: null,
    expected: [200],
    jwt: null,        // Not used
    timeout: timeout,
    callback: callback
  };
  return this.makeRequest(options);
};

ApiRequest.prototype.makePostRequest = function(url, content, timeout, callback) {
  const options = {
    verb: "POST",
    url: url,
    content: content,
    expected: [200, 201],
    jwt: null,        // Not used
    timeout: timeout,
    callback: callback
  };
  return this.makeRequest(options);
};

ApiRequest.prototype.makePutRequest = function(url, content, timeout, callback) {
  const options = {
    verb: "PUT",
    url: url,
    content: content,
    expected: [200, 201],
    jwt: null,        // Not used
    timeout: timeout,
    callback: callback
  };
  return this.makeRequest(options);
};

ApiRequest.prototype.makeDeleteRequest = function(url, timeout, callback) {
  const options = {
    verb: "DELETE",
    url: url,
    content: null,
    expected: [200, 204],
    jwt: null,        // Not used
    timeout: timeout,
    callback: callback
  };
  return this.makeRequest(options);
};

ApiRequest.prototype.terminateRequest = function() {
  logger("Attempting to terminate request with id", this._id);
  if ((this._request.readyState <= 1) && this._dispatcher) {
    // the request has not been sent so take it off the queue
    this._dispatcher.dequeue(this);
    return this;
  }
  return null;
}

module.exports = ApiRequest;
