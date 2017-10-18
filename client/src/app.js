'use strict'

const Repository = require('./network/repository');
const UI = require('./view/ui');
const baseURL = "https://c4a.etive.org:8443/api";

const onDeviceReady = function() {
  // Allow the app to work in background mode
  cordova.plugins.backgroundMode.enable();
  // Allow the app to start automatically at boot time
  cordova.plugins.autoStart.enable();
  // Create a repository to handle the network comms
	const repository = new Repository(baseURL);
	// Create the UI
	const ui = new UI(repository);
};

window.onload = function(){
	document.addEventListener('deviceready', onDeviceReady, false);
};