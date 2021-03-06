"use strict"

const Scan = require('./scan');
const logger = require('../logger');
const positionToString = require('../utility').positionToString;

const minScanDuration = 15000;  // milliseconds
const DESIRED_ACCURACY = 100; // metres

const Scanner = function(repository, onStatusChange, ignoreLocation = false){
  this._repository = repository;
  this._onStatusChange = onStatusChange;
  this._scanStartTime = null;
  this._startGeolocationPending = false;
  this._stopScanPending = false;
  this._ignoreLocation = ignoreLocation;
  this._scan = new Scan(
    this._repository.foundBeacon.bind(this._repository),
    this._repository.lostBeacon.bind(this._repository),
    function(error) {
      logger.log("Scan Error:", error);
      this._onStatusChange("Scan Error: " + error);
      // Do nothing else, the logic will attempt to restart the scan
    }.bind(this)
  );

  backgroundGeolocation.configure(
    this._movedTo.bind(this),
    this._onGeoError.bind(this),
    {
      desiredAccuracy: DESIRED_ACCURACY, // Desired accuracy in meters. Possible values [0, 10, 100, 1000].
                                         // The lower the number, the more power devoted to GeoLocation.
                                         // 1000 results in lowest power drain and least accurate readings.
      stationaryRadius: 3, // Stationary radius in metres. The minimum distance the device must
                           // move beyond the stationary location for background-tracking to engage
      distanceFilter: 3,   // The minimum distance in meters a device must move before an update event is generated
      stopOnTerminate: true,  // Force a stop() when the application terminated

      // Location provider settings
      // locationProvider: backgroundGeolocation.provider.ANDROID_DISTANCE_FILTER_PROVIDER
      locationProvider: backgroundGeolocation.provider.ANDROID_ACTIVITY_PROVIDER,
      interval: 15000,            // Rate in milliseconds at which the app prefers to receive location updates
      fastestInterval: 5000,      // Fastest rate in milliseconds at which your app can handle location updates
      activitiesInterval: 30000,  // Rate in milliseconds at which activity recognition occurs
                                  // Larger values will result in fewer activity detections while improving battery life

      notificationTitle: "Beacon Proximity Detector"
    }
  );
  backgroundGeolocation.onStationary(this._stationaryAt.bind(this), this._onGeoError)
  backgroundGeolocation.watchLocationMode(this._geolocationModeChange.bind(this), this._onGeoError)

  Object.defineProperty(this, "beacons",
    { get: function(){ return this._scan.beacons; } }
  );
};

Scanner.prototype._startGeolocation = function() {
  logger.log("Geolocation starting")
  backgroundGeolocation.start();
  this._startGeolocationPending = false;
}

Scanner.prototype._startScan = function() {
  if (this._stopScanPending) this._stopScanPending = false;
  if (this._scanStartTime) return;
  logger.log("Starting the scan")
  this._scan.start();
  this._scanStartTime = Date.now();
  this._onStatusChange("Scanning for Beacons."); 
}

Scanner.prototype._resetScan = function (outOfRange = true) {
  this._scan.stop(outOfRange);
  this._scanStartTime = null;
  this._stopScanPending = false;
}

Scanner.prototype._stopScan = function(outOfRange) {

  const stopNow = function(scanner) {
    // Don't stop the scan if the pending flag has been reset by a _startScan() request
    if (!scanner._stopScanPending) return;
    scanner._resetScan(outOfRange);
    scanner._onStatusChange("Scanning paused.");
  }

  if (!this._scanStartTime) return;
  logger.log("Scan pause requested")
  if (this._ignoreLocation) {
    logger.log("Debug mode: Will not pause scan");
    return;
  }
  const duration = Date.now() - this._scanStartTime;
  this._stopScanPending = true;
  if (duration >= minScanDuration) {
    stopNow(this);
  }
  else {
    const remainingDuration = minScanDuration - duration;
    logger.log("Pausing scan in", remainingDuration + "ms");
    setTimeout(function() { stopNow(this) }.bind(this), remainingDuration);
  }
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
  const φ1 = toRadians(latLngA.latitude);
  const φ2 = toRadians(latLngB.latitude);
  const Δφ = toRadians(latLngB.latitude - latLngA.latitude);
  const Δλ = toRadians(latLngB.longitude - latLngA.longitude);

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const d = R * c;

  return d;
}

Scanner.prototype._nearBeacons = function(geoLocation) {
  const regions = this._repository.regions;

  if (!regions) return true;

  const accuracy = geoLocation.accuracy;

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    const range = this._metresBetween(region.point, geoLocation);
    // Check if region and position centres are closer together than the sum of the radii
    // If they are then exit the loop and return true
    if (range < (region.radius + accuracy)) {
      logger.log("Beacons in range:", Math.round(range), "metres away");
      return true;
    }
  }
  this._logDistanceToBeacons(geoLocation);
  return false;
}

Scanner.prototype._logDistanceToBeacons = function(geoLocation) {
  const regions = this._repository.regions;

  if (!(regions && logger.isLogging)) return;

  let range = 0;
  let minDistance = Number.MAX_VALUE;
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    range = this._metresBetween(region.point, geoLocation);
    minDistance = Math.min(minDistance, range);
  }
  logger.log("Beacons", Math.round(minDistance), "metres away");
}

Scanner.prototype._movedTo = function(position) {
  // Only scan whilest close to beacons
  logger.log("Device moved to lat:", position.latitude,
    "lng:", position.longitude, "(accuracy:", position.accuracy + ")");
  if (this._nearBeacons(position))
    this._startScan();
  else
    this._stopScan(true); // out of range
  backgroundGeolocation.finish();
};

Scanner.prototype._stationaryAt = function(position) {
  // Don't scan whilst stationary
  logger.log("Device stationary at lat:", position.latitude,
    "lng:", position.longitude, "(accuracy:", position.accuracy + ")");
  this._logDistanceToBeacons(position);
  this._stopScan(false); // still in range
  backgroundGeolocation.finish();
}

Scanner.prototype._geolocationModeChange = function(enabled) {
  // If the location service is not enabled have to scan all the time
  logger.log("Geolocation has been turned", (enabled) ? "on" : "off");
  if (!enabled)
    this._startScan();
  else
    if (this._startGeolocationPending) this._startGeolocation();
}

Scanner.prototype._onGeoError = function(geolocationError) {
  this._onStatusChange(geolocationError.message);
}

Scanner.prototype.start = function() {
  // this._onStatusChange("Scan pending.");
  // Start the scan immediately - if stationary it will be turned off quickly.
  this._startScan();
  // Turn ON the background-geolocation system.  The user will be tracked whenever they suspend the app.
  backgroundGeolocation.isLocationEnabled(function(enabled){
    this._startGeolocationPending = true;
    if (enabled) this._startGeolocation();
  }.bind(this), this._onGeoError);
}

Scanner.prototype.stop = function() {
  this._scan.stop();
  this._onStatusChange('Scanning stopped.');
  backgroundGeolocation.stop();
}

module.exports = Scanner;