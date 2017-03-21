"use strict"

const Phone = function(){
  Object.defineProperty(this, "isIOS", { get: function(){ return /iP(hone|ad|od)/.test(navigator.userAgent); } });
  Object.defineProperty(this, "isIOS7", { get: function(){ return /iP(hone|ad|od).*OS 7/.test(navigator.userAgent); } });
  Object.defineProperty(this, "isAndroid", { get: function(){ return /Android|android/.test(navigator.userAgent); } });
  Object.defineProperty(this, "isWP", { get: function(){ return /Windows Phone/.test(navigator.userAgent); } });  
};

Phone.prototype.adjustLayout = function() {
  // Set an absolute base font size in iOS 7 due to that viewport-relative
  // font sizes doesn't work properly caused by the WebKit bug described at
  // https://bugs.webkit.org/show_bug.cgi?id=131863.
  if (this.isIOS7) {
    document.body.style.fontSize = '20pt';
  }
};

let phone = new Phone();  // Singleton

module.exports = phone;
