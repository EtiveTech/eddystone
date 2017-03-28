"use strict"

const logger = require('../utility').logger;
const dispatcher = require('./api_request_dispatcher');
const XMLHttpRequest = (process.env.NODE_ENV === 'test') ? require('../stubs').XMLHttpRequest : window.XMLHttpRequest;

const ApiRequest = function() {
  this._request = new XMLHttpRequest();
  this._options = null;
  this._json = null;
  this._timeoutID = null;
  this._status = 'created';
  this._id = 0;
  this._tries = 0;

  Object.defineProperty(this, "timeout", { get: function() { return this._options.timeout; } });
  Object.defineProperty(this, "callback", { get: function() { return this._options.callback; } });
  Object.defineProperty(this, "status", { get: function() { return this._status; } });
  Object.defineProperty(this, "id", { get: function() { return this._id; } });
  Object.defineProperty(this, "retries", { get: function() { return (this._tries > 0) ? this._tries - 1 : 0; } });
};

ApiRequest.prototype._setRequest = function(options) {
  this._request.open(options.verb, options.url);
  if (options.jwt) this._request.setRequestHeader('Authorization', 'Bearer ' + options.jwt);
  if (options.content) this._request.setRequestHeader('Content-Type', 'application/json');

  this._request.onload = function() {
    // In the callback, 'this' is the request
    let errorStatus = (options.expected.indexOf(this.status) === -1);
    let content = ((this.status === 204) || errorStatus ) ? null : JSON.parse(this.responseText);
    logger( options.verb + " request to " + options.url + " returned status " + this.status);
    options.callback(this.status, content);
  };

  if (options.content) this._json = JSON.stringify(options.content);
};

ApiRequest.prototype._resetRequest = function() {
  this._request = new XMLHttpRequest();
  this._setRequest(this._options);
  return this;
};

ApiRequest.prototype._makeRequest = function(options) {
  this._options = options;
  this._setRequest(options);
  return dispatcher.dispatch(this);
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
  return this._makeRequest(options);
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
  return this._makeRequest(options);
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
  return this._makeRequest(options);
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
  return this._makeRequest(options);
};

module.exports = ApiRequest;
