"use strict"

const Scan = require('./scan');

const regionInterval = ((process.env.NODE_ENV === 'test') ? 1 : 1440) * 60 * 1000;

const Scanner = function(repository, onStatusChange){
  this._repository = repository;
  this._onStatusChange = onStatusChange;

  this._regionTimestamp = 0;
  this._regions = null;
  this._regionTimer = setInterval(this._getRegions.bind(this), regionInterval);
  this._getRegions();

  this._scan = new Scan(
    this._repository.foundBeacon.bind(this._repository),
    this._repository.lostBeacon.bind(this._repository),
    function(errorCode) { this._onStatusChange("Scan Error: " + errorCode) }.bind(this)
  );

  Object.defineProperty(this, "beacons", { get: function(){ return this._scan.beacons; } }); 
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

Scanner.prototype.start = function() {
  this._scan.start();
}

Scanner.prototype.stop = function() {
  this._scan.stop();
}

module.exports = Scanner;