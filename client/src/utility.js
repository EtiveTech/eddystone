"use strict"

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

const logger = function() {
  if (true) {
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
    console.log(text);
  }
};

const network = {
  get online() { return(navigator.connection.type !== Connection.NONE) }
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