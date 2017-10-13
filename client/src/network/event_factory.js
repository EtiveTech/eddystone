"use strict"

const Request = require('./api_request');
const arrayToHex = require('../utility').arrayToHex;

const proximityRoute = "proximity";
const deviceRoute = "device";
const foundType = "found";
const lostType = "lost";

const EventFactory = function(baseURL, token) {
  this._baseURL = baseURL;
  this._token = token;
  this._deviceId = (process.env.NODE_ENV === 'test') ? "test-uuid" : device.uuid;
  this._lastHeartbeat = null;
  this._events = {};

  // Check if there are any persisted events. If there are, resend them.
  // this._resendEvents()
}

EventFactory.prototype._resendEvents = function(options) {
  for (let i = 0; i < options.length; i++) {
      let request = new Request();
      request.makeRequest(options[i]);
      this._addEvent(request);
  }
}

EventFactory.prototype._persistEvents = function() {
  let eventOptions = []
  for (let event in this._events) {
    eventOptions << event.options;
  }
  // persist eventOptions
}

EventFactory.prototype._addEvent = function(event) {
  this._events[request.id] = request;
  // now persist the events
}

EventFactory.prototype._removeEvent = function(event) {
  delete this._events[request.id];
  // now persist the events
} 

EventFactory.prototype._proximityContent = function(type, beacon) {
  const content = {
    eventType: type,
    timestamp: Date.now(),
    beaconId: arrayToHex(beacon.bid),
    rssi: beacon.rssi,
    uuid: this._deviceId,
    token: this._token
  }

  if (type === foundType) content.txPower = beacon.txPower;
  if (type === lostType) content.rssiMax = beacon.rssiMax;

  return content;
}

EventFactory.prototype.foundBeaconEvent = function(beacon, onCompleted) {
  const request = new Request();
  const content = this._proximityContent(foundType, beacon);

  // Mark the beacon as a confirmed beacon in case the reply to the network request
  // comes after the lost event. If unconfirmed the lost event would not be sent.
  beacon.confirmed = true;

  // Beacon events are not allowed to time out
  request.makePostRequest(this._baseURL + proximityRoute, content, false, function(status) {
    this._removeEvent(request);
    // Beacon is confirmed by default now update with the server response
    // Note that the lost event may have been sent before this code is executed
    beacon.confirmed = (status === 201);
    // Might not be authorised to send to the server or the api key may be wrong
    if (onCompleted) onCompleted(status);
  });

  this._addEvent(request);
}

EventFactory.prototype.lostBeaconEvent = function(beacon, onCompleted) {
  const request = new Request();
  const content = this._proximityContent(lostType, beacon);

  // Beacon events are not allowed to time out
  request.makePostRequest(this._baseURL + proximityRoute, content, false, function(status) {
    this._removeEvent(request);
    // Might not be authorised to send to the server or the api key may be wrong
    if (onCompleted) onCompleted(status);
  });

  this._addEvent(request);
}

EventFactory.prototype.heartbeat = function(onCompleted) {
  const request = new Request();
  const content = {
    timestamp: Date.now(),
    token: this._token
  }

  // If the last heartbeat message is still sitting on the queue delete it to stop the requests building up
  if (this._lastHeartbeat) this._lastHeartbeat.terminateRequest();
  
  // Make a note of the requets so it can be deleted later if needed
  this._lastHeartbeat = request.makePutRequest(this._baseURL +
    deviceRoute + "/" + this._deviceId, content, false, function(status) {
    // Might not be authorised to send to the server or the api key may be wrong
    if (onCompleted) onCompleted(status);
  });
}

module.exports = EventFactory;