"use strict"

const Scan = require('./scan');
const logger = require('../utility').logger;

const regionInterval = ((process.env.NODE_ENV === 'test') ? 1 : 1440) * 60 * 1000;

const Scanner = function(repository, onStatusChange){
  this._repository = repository;
  this._onStatusChange = onStatusChange;
  this._watchId = null;
  this._scanning = false;

  this._regionTimestamp = 0;
  this._regions = null;
  this._regionTimer = setInterval(this._getRegions.bind(this), regionInterval);
  this._getRegions();

  this._scan = new Scan(
    this._repository.foundBeacon.bind(this._repository),
    this._repository.lostBeacon.bind(this._repository),
    function(errorCode) { this._onStatusChange("Scan Error: " + errorCode) }.bind(this)
  );

  Object.defineProperty(this, "beacons",
    { get: function(){ return (this._scanning) ? this._scan.beacons : {}; } }
  ); 
};

Scanner.prototype._getRegions = function() {
  this._repository.fetchRegions(function(data) {
    const timestamp = Number(data.changed);
    if (timestamp > this._regionTimestamp) {
      this._regionTimestamp = timestamp;
      this._regions = data.regions;
    }
  }.bind(this));
};

Scanner.prototype._startScan = function() {
  this._scan.start();
  this._scanning = true;
  this._onStatusChange("Scanning..."); 
}

Scanner.prototype._stopScan = function() {
  this._scan.stop();
  this._scanning = false;
  this._onStatusChange("Scanning paused."); 
}

Scanner.prototype._distanceBetween = function( latLngA, latLngB ) {

  // Haversine
  // formula:  a = sin²(Δφ/2) + cos φ1 ⋅ cos φ2 ⋅ sin²(Δλ/2)
  // c = 2 ⋅ atan2( √a, √(1−a) )
  // d = R ⋅ c
  // where φ is latitude, λ is longitude, R is earth’s radius (mean radius = 6,371km);
  // note that angles need to be in radians to pass to trig functions!

  function toRadians(x) {
    return x * Math.PI / 180;
  }

  var R = 6371e3; // metres
  var φ1 = toRadians(latLngA.lat);
  var φ2 = toRadians(latLngB.lat);
  var Δφ = toRadians(latLngB.lat - latLngA.lat);
  var Δλ = toRadians(latLngB.lng - latLngA.lng);

  var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  var d = R * c;

  return d;
}

Scanner.prototype._nearBeacons = function(position) {
  if (!this._regions) return true;
  for (let region of this._regions) {
    // Check if region and position centres are closer together than the sum of the radii
    // If they are then return true
    const d = this._distanceBetween(region.point, { lat: position.latitide, lng: position.longitude });
    if (d < (region.radius + position.accuracy)) return true;
  }
  return false;
}

Scanner.prototype._startingPoint = function(position) {
  logger("Starting at lat:", position.coords.latitude, "lng:", position.coords.longitude);
  if (this._nearBeacons(position.coords)) this._startScan();
};

Scanner.prototype._movedTo = function(position) {
  logger("Moved to lat:", position.coords.latitude,
    "lng:", position.coords.longitude, "(accuracy:", position.coords.accuracy + ")");
  if (this._nearBeacons(position.coords)) {
    if (!this._scanning) this._startScan();
  }
  else {
    if (this._scanning) this._stopScan();
  }
};

Scanner.prototype._onGeoError = function(geolocationError) {
  this._onStatusChange(geolocationError.message);
}

Scanner.prototype.start = function() {
  this._onStatusChange("Scan pending.")
  // navigator.geolocation.getCurrentPosition(
    // this._startingPoint.bind(this), this._onGeoError, { maximumAge: 5000, timeout: 5000 });
  this._watchId = navigator.geolocation.watchPosition(this._movedTo.bind(this));
}

Scanner.prototype.stop = function() {
  this._scan.stop();
  this._onStatusChange('Scanning stopped.');
  navigator.geolocation.clearWatch(this._watchId);
}

module.exports = Scanner;