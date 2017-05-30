"use strict"

const Scan = require('./scan');
const logger = require('../utility').logger;
const positionToString = require('../utility').positionToString;

const Scanner = function(repository, onStatusChange){
  this._repository = repository;
  this._onStatusChange = onStatusChange;
  this._scanning = false;
  this._scan = new Scan(
    this._repository.foundBeacon.bind(this._repository),
    this._repository.lostBeacon.bind(this._repository),
    function(errorCode) { this._onStatusChange("Scan Error: " + errorCode) }.bind(this)
  );

  backgroundGeolocation.configure(
    this._movedTo.bind(this),
    this._onGeoError.bind(this),
    {
      desiredAccuracy: 10,
      stationaryRadius: 3,
      distanceFilter: 5,
      stopOnTerminate: true,
      // locationProvider: backgroundGeolocation.provider.ANDROID_DISTANCE_FILTER_PROVIDER
      locationProvider: backgroundGeolocation.provider.ANDROID_ACTIVITY_PROVIDER,
      interval: 15000,
      fastestInterval: 5000,
      activitiesInterval: 10000
    }
  );

  Object.defineProperty(this, "beacons",
    { get: function(){ return this._scan.beacons; } }
  ); 
};

Scanner.prototype._startScan = function() {
  if (this._scanning) return;
  logger("Starting the scan")
  this._scan.start();
  this._scanning = true;
  this._onStatusChange("Scanning..."); 
}

Scanner.prototype._stopScan = function() {
  if (!this._scanning) return;
  logger("Pausing the scan")
  this._scan.stop();
  this._scanning = false;
  this._onStatusChange("Scanning paused"); 
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
    if (d < (region.radius + accuracy)) {
      logger("Beacons are", Math.round(d), "metres away or less")
      return true;
    }
  }
  return false;
}

Scanner.prototype._movedTo = function(position) {
  logger("Moved to", positionToString(position));

  // Only scan whilest close to beacons
  if (this._nearBeacons(position))
    this._startScan();
  else
    this._stopScan();
};

Scanner.prototype._stationaryAt = function(position) {
  logger("Stationary at", positionToString(position));

  // Don't scan whilst stationary
  this._stopScan();
}

Scanner.prototype._onGeoError = function(geolocationError) {
  this._onStatusChange(geolocationError.message);
}

Scanner.prototype.start = function() {
  this._onStatusChange("Scan pending.")

  // Turn ON the background-geolocation system.  The user will be tracked whenever they suspend the app. 
  backgroundGeolocation.start();
  backgroundGeolocation.onStationary(this._stationaryAt.bind(this), this._onGeoError)
}

Scanner.prototype.stop = function() {
  this._scan.stop();
  this._onStatusChange('Scanning stopped.');
  backgroundGeolocation.stop();
}

module.exports = Scanner;