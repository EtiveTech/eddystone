"use strict"

const Scan = require('./scan');
const logger = require('../utility').logger;
const positionToString = require('../utility').positionToString;

const minScanLength = 10000; // milliseconds
const desiredAccuracy = 100; // metres
const marginOfError = Math.floor(desiredAccuracy / 2);

const Scanner = function(repository, onStatusChange){
  this._repository = repository;
  this._onStatusChange = onStatusChange;
  this._scanStartTime = null;
  this._stopPending = false;
  this._stationary = 0;
  this._scan = new Scan(
    this._repository.foundBeacon.bind(this._repository),
    this._repository.lostBeacon.bind(this._repository),
    function(errorCode) { this._onStatusChange("Scan Error: " + errorCode) }.bind(this)
  );

  backgroundGeolocation.configure(
    this._movedTo.bind(this),
    this._onGeoError.bind(this),
    {
      desiredAccuracy: desiredAccuracy,
      stationaryRadius: 3,
      distanceFilter: 3,
      stopOnTerminate: true,
      // locationProvider: backgroundGeolocation.provider.ANDROID_DISTANCE_FILTER_PROVIDER
      locationProvider: backgroundGeolocation.provider.ANDROID_ACTIVITY_PROVIDER,
      interval: 15000,
      fastestInterval: 5000,
      activitiesInterval: 30000
    }
  );

  Object.defineProperty(this, "beacons",
    { get: function(){ return this._scan.beacons; } }
  );
};

Scanner.prototype._startScan = function() {
  if (this._stopPending) this._stopPending = false;
  if (this._scanStartTime) return;
  logger("Starting the scan")
  this._scan.start();
  this._scanStartTime = Date.now();
  this._onStatusChange("Scanning..."); 
}

Scanner.prototype._stopScan = function() {

  const stopNow = function(scanner) {
    // Don't stop the scan if the pending flag has been reset by a _startScan() request
    if (!scanner._stopPending) return;
    logger("Pausing the scan")
    scanner._scan.stop();
    scanner._scanStartTime = null;
    scanner._stopPending = false;
    scanner._onStatusChange("Scanning paused");
  }

  if (!this._scanStartTime) return;
  logger("Scan pause requested")
  const diff = Date.now() - this._scanStartTime;
  this._stopPending = true;
  if (diff >= minScanLength)
    stopNow(this);
  else
    setTimeout(function() { stopNow(this) }.bind(this), minScanLength - diff);
}

Scanner.prototype._metresBetween = function( latLngA, latLngB ) {

  // Haversine
  // formula:  a = sin²(Δφ/2) + cos φ1 ⋅ cos φ2 ⋅ sin²(Δλ/2)
  // c = 2 ⋅ atan2( √a, √(1−a) )
  // d = R ⋅ c
  // where φ is latitude, λ is longitude, R is earth’s radius (mean radius = 6,371km);
  // note that angles need to be in radians to pass to trig functions!

  function toRadians(x) {
    return x * Math.PI / 180;
  }

  const R = 6371e3; // metres
  const φ1 = toRadians(latLngA.lat);
  const φ2 = toRadians(latLngB.lat);
  const Δφ = toRadians(latLngB.lat - latLngA.lat);
  const Δλ = toRadians(latLngB.lng - latLngA.lng);

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const d = R * c;

  return d;
}

Scanner.prototype._nearBeacons = function(geoLocation) {
  if (!this._repository.regions) return true;

  const position = { lat: geoLocation.latitude, lng: geoLocation.longitude };
  const accuracy = geoLocation.accuracy;

  for (let region of this._repository.regions) {
    // Check if region and position centres are closer together than the sum of the radii
    // If they are then return true
    const d = this._metresBetween(region.point, position);
    if (d < (region.radius + marginOfError + accuracy)) {
      logger("Beacons in range:", Math.round(d), "metres away or less")
      return true;
    }
  }
  return false;
}

Scanner.prototype._movedTo = function(position) {
  if (this._stationary) {
    const secondsStationary = Math.round((Date.now() - this._stationary) / 1000);
    logger("Time stationary", Math.round(secondsStationary * 10 / 6) / 100, "minutes");
    // Log the currrent position?
    this._repository.trackStationary(position, this._stationary, secondsStationary)
    this._stationary = 0;
  }

  // Only scan whilest close to beacons
  if (this._nearBeacons(position))
    this._startScan();
  else
    this._stopScan();
  backgroundGeolocation.finish();
};

Scanner.prototype._stationaryAt = function(position) {
  logger("Stationary at", positionToString(position));
  this._stationary = Date.now();
  // Don't scan whilst stationary
  this._stopScan();
  backgroundGeolocation.finish();
}

Scanner.prototype._geolocationModeChange = function(enabled) {
  // If the location service is not enabled have to scan all the time
  logger("Geolocation has been turned", (enabled) ? "on" : "off");
  if (!enabled) this._startScan();
}

Scanner.prototype._onGeoError = function(geolocationError) {
  logger(JSON.stringify(geolocationError));
  this._onStatusChange(geolocationError.message);
}

Scanner.prototype.start = function() {
  this._onStatusChange("Scan pending.");
  // Start the scan immediately - if stationary it will be turned off quickly.
  this._startScan();
  // Turn ON the background-geolocation system.  The user will be tracked whenever they suspend the app. 
  backgroundGeolocation.onStationary(this._stationaryAt.bind(this), this._onGeoError)
  backgroundGeolocation.watchLocationMode(this._geolocationModeChange.bind(this), this._onGeoError)
  backgroundGeolocation.start();
}

Scanner.prototype.stop = function() {
  this._scan.stop();
  this._onStatusChange('Scanning stopped.');
  backgroundGeolocation.stop();
}

module.exports = Scanner;