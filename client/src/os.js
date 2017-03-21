"use strict"

let os = {};

/**
 * Returns true if current platform is iOS, false if not.
 * @return {boolean} true if platform is iOS, false if not.
 * @public
 */
os.isIOS = function()
{
	return /iP(hone|ad|od)/.test(navigator.userAgent);
};

/**
 * Returns true if current platform is iOS 7, false if not.
 * @return {boolean} true if platform is iOS 7, false if not.
 * @public
 */
os.isIOS7 = function()
{
	return /iP(hone|ad|od).*OS 7/.test(navigator.userAgent);
};

/**
 * Returns true if current platform is Android, false if not.
 * @return {boolean} true if platform is Android, false if not.
 * @public
 */
os.isAndroid = function()
{
	return /Android|android/.test(navigator.userAgent);
};

/**
 * Returns true if current platform is Windows Phone, false if not.
 * @return {boolean} true if platform is Windows Phone, false if not.
 * @public
 */
os.isWP = function()
{
	return /Windows Phone/.test(navigator.userAgent);
};

const applyiOS7LayoutHack = function()
{
  // Set an absolute base font size in iOS 7 due to that viewport-relative
  // font sizes doesn't work properly caused by the WebKit bug described at
  // https://bugs.webkit.org/show_bug.cgi?id=131863.
  if (os.isIOS7())
  {
    document.body.style.fontSize = '20pt';
  }
};

module.exports = {
	os: os,
	applyiOS7LayoutHack: applyiOS7LayoutHack
};