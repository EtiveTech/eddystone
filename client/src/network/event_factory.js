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
  this._proximityEvents = [];
  this._heartbeatEvents = [];
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
    // Beacon is confirmed by default now update with the server response
    // Note that the lost event may have been sent before this code is executed
    beacon.confirmed = (status === 201);
    // Might not be authorised to send to the server or the api key may be wrong
    if (onCompleted) onCompleted(status);
  });
}

EventFactory.prototype.lostBeaconEvent = function(beacon, onCompleted) {
  const request = new Request();
  const content = this._proximityContent(lostType, beacon);

  // Beacon events are not allowed to time out
  request.makePostRequest(this._baseURL + proximityRoute, content, false, function(status) {
    // Might not be authorised to send to the server or the api key may be wrong
    if (onCompleted) onCompleted(status);
  });
}

EventFactory.prototype.heartbeatEvent = function(onCompleted) {
  const request = new Request();
  const content = {
    timestamp: Date.now(),
    token: this._token
  }
  
  // Let heartbeat requests timeout if not sent. They are sent a few times every hour. No point in stock-piling
  request.makePutRequest(this._baseURL + deviceRoute + "/" + this._deviceId, content, true, function(status) {
    // Might not be authorised to send to the server or the api key may be wrong
    if (onCompleted) onCompleted(status);
  });
}

module.exports = EventFactory;