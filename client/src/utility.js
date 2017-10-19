"use strict"

let connectionTypes = null;

const getBrowserWidth = function(){
  if (self.innerWidth) return self.innerWidth;
  if (document.documentElement && document.documentElement.clientWidth) {
    return document.documentElement.clientWidth;
  }
  if (document.body) return document.body.clientWidth;
};

const getBrowserHeight = function(){
  const body = document.body;
  const html = document.documentElement;

  return Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
};

const getScript = function(source, callback) {
  let script = document.createElement('script');
  script.async = 1;

  const prior = document.getElementsByTagName('script')[0];
  prior.parentNode.insertBefore(script, prior);

  script.onload = script.onreadystatechange = function( _, isAbort ) {
    if(isAbort || !script.readyState || /loaded|complete/.test(script.readyState) ) {
      script.onload = script.onreadystatechange = null;
      script = undefined;

      if(!isAbort) { if(callback) callback(); }
    }
  };

  script.src = source;
};

const logger = {
  _logToFile: true,
  _logToConsole: true,
  _logFile: null,

  log: function() {
    if (this._logToConsole || this._logToFile) {
      const date = new Date();
      const ms = date.getMilliseconds();
      let padding = "";
      if (ms < 100) {
        padding = (ms < 10) ? "00" : "0";
      }
      let text = date.toTimeString().split(" ")[0] + "." + padding + ms;
      for (let i = 0; i < arguments.length; i++) {
        text += " " + arguments[i]
      }

      if (this._logToConsole) console.log(text);
      if (this._logToFile && this._logFile) this._fileLog(text + "\n");
    }
  },

  init: function(toConsole, toFile, onCompleted) {
    this._logToConsole = toConsole;
    this._logToFile = toFile;

    if (toFile && !this._logFile) {
      window.resolveLocalFileSystemURL(cordova.file.externalDataDirectory, function (dir) {
        if (toConsole) console.log('file system open: ' + dir.name);
        dir.getFile("city4age-log.txt", {create:true}, function(file) {
          if (toConsole) console.log("Creating log file")
          this._logFile = file;
          onCompleted();
        }.bind(this));
      }.bind(this));
    }
    else {
      onCompleted();
    }
  },

  _fileLog: function(text) {
    if (!this._logFile) return;

    this._logFile.createWriter(function (fileWriter) {
      if (this._logToConsole) {
        fileWriter.onerror = function (e) { console.log("Failed file write: " + e.toString()); };
        fileWriter.onwriteend = function() { console.log("Successful file write..."); };
      }

      const blob = new Blob([text], { type: 'text/plain' });
      fileWriter.seek(fileWriter.length);
      fileWriter.write(blob);
    }.bind(this));
  }
};

const _initConnectionTypes = function() {
  // Can only do this after the device is ready.
  connectionTypes = {};
  connectionTypes[Connection.UNKNOWN]  = 'Unknown connection';
  connectionTypes[Connection.ETHERNET] = 'Ethernet connection';
  connectionTypes[Connection.WIFI]     = 'WiFi connection';
  connectionTypes[Connection.CELL_2G]  = 'Cell 2G connection';
  connectionTypes[Connection.CELL_3G]  = 'Cell 3G connection';
  connectionTypes[Connection.CELL_4G]  = 'Cell 4G connection';
  connectionTypes[Connection.CELL]     = 'Cell generic connection';
  connectionTypes[Connection.NONE]     = 'No network connection';
}

const network = {
  // navigator.connection.type will only exist after the device is ready
  get online() { return((navigator.connection.type !== Connection.NONE) &&
                        (navigator.connection.type !== Connection.UNKNOWN)) },
  get offline() { return((navigator.connection.type === Connection.NONE) ||
                        (navigator.connection.type === Connection.UNKNOWN)) },
  get connectionType() { if (!connectionTypes) _initConnectionTypes(); return connectionTypes[navigator.connection.type]; }
};

const arrayToHex = function(array) {
  let hexString = '';
  if (array) {
    for (let i = 0; i < array.length; i++) {
      let string = (new Number(array[i])).toString(16);
      if (string.length < 2) string = '0' + string;
      hexString += string;
    }
  }
  return hexString;
}

const positionToString = function(position) {
  const digits = 5;
  const multiplier = Math.pow(10, digits);

  const round = function(value) {
    return Math.round(value * multiplier) / multiplier; 
  }

  return "lat,lng: " + round(position.latitude) + "," + round(position.longitude) +
    " (" + position.provider + ", " + "accuracy: " + round(position.accuracy) + ")";
}

module.exports = {
  getBrowserWidth: getBrowserWidth,
  getBrowserHeight: getBrowserHeight,
  getScript: getScript,
  logger: logger,
  network: network,
  arrayToHex: arrayToHex,
  positionToString: positionToString
};