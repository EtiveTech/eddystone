"use strict"

const Battery = function() {
  this._isPlugged = false;
  this._level = 0;

  if (typeof document !== "undefined") {
    document.addEventListener("batterystatus", this._onBatteryStatus.bind(this), false);
  }

  Object.defineProperty(this, "isPlugged", { get: function(){ return this._isPlugged; } });
  Object.defineProperty(this, "chargeLevel", { get: function(){ return this._level; } });
}

Battery.prototype._onBatteryStatus = function(status) {
  this._level = status.level;
  this._isPlugged = status.isPlugged;
}

module.exports = Battery;
