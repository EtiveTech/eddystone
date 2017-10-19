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
  network: network,
  arrayToHex: arrayToHex,
  positionToString: positionToString
};