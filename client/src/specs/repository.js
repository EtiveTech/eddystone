"use strict"

process.env.NODE_ENV = 'test';

const sinon = require('sinon');
const assert = require("assert");
const Repository = require('../network/repository');
const network = require('../stubs').network;
const server = require('../stubs').HttpServer;
const localStorage = require('../stubs').localStorage;
const apiKey = require('../keys').localRepository;
const logger = require('../utility').logger;

const baseURL = "https://cj101d.ifdnrg.com/";
const beaconLog = "beacon-log";
const tokenKey = "token";

describe("Repository Requests", function() {
	const token = "01234-01234567-0123456789";

  describe("All Request Types", function() {
		const repository = new Repository(baseURL);

	  beforeEach(function() {
	    server.initialize();
	    network.online = true;
	  });

	  it('Won\'t send a request without authorisation', function() {
	  	const url = baseURL + beaconLog;

	  	repository.hello();
	  	repository.foundBeacon();
	  	repository.lostBeacon();

	  	assert.strictEqual(server.requests.length, 0);
	  });

	  it('Authorizes a user', function() {
	  	const url = baseURL + "authorize";
	  	const email = "test@etive.org";
	  	const json = JSON.stringify({token: token});

	  	server.respondWith("POST", url, [201, json]);

	  	repository.authorize(email);
	    assert.strictEqual(server.requests[0].verb, "POST");
	    assert.strictEqual(server.requests[0].url, url);
			assert.notStrictEqual(server.requests[0].content, null);

	  	const content = JSON.parse(server.requests[0].content);
	    assert.strictEqual(content.email, email);
	    assert.strictEqual(content.key, apiKey);

	    server.respond();

	    assert.strictEqual(repository._token, token);
	    assert.strictEqual(localStorage.getItem(tokenKey), token);
	  });

	  it('Creates a request using authorisation', function() {
	  	const url = baseURL + beaconLog;

	  	repository.hello();

			const content = JSON.parse(server.requests[0].content);
	    assert.strictEqual(content.eventType, "hello");
	    assert.strictEqual(content.token, token);
	    assert.strictEqual(content.datetime > 0, true);
	  });

	  it('Creates a Found Beacon request', function() {
	  	const url = baseURL + beaconLog;
	  	const beaconId = 'c4a000000001';
      const beaconAddress = 'DE:59:85:F2:EB:E9';
      const beaconRSSI = -90;
      const beaconTxPower = -72;

	  	repository.foundBeacon({
	  		bid: [0xc4, 0xa0, 0, 0, 0, 1],
	  		address: beaconAddress,
	  		rssi: beaconRSSI,
	  		txPower: beaconTxPower
	  	});

	    assert.strictEqual(server.requests[0].verb, "POST");
	    assert.strictEqual(server.requests[0].url, url);
			assert.notStrictEqual(server.requests[0].content, null);

			const content = JSON.parse(server.requests[0].content);
	    assert.strictEqual(content.eventType, "found");
	    assert.strictEqual(content.datetime > 0, true);
	    assert.strictEqual(content.beaconId, beaconId);
	    assert.strictEqual(content.address, beaconAddress);
	    assert.strictEqual(content.rssi, beaconRSSI);
	    assert.strictEqual(content.txPower, beaconTxPower);
	    assert.strictEqual(content.token, token);
	  });

	  it('Creates a Lost Beacon request', function() {
	  	const url = baseURL + beaconLog;
	  	const beaconId = 'c4a000000001';
      const beaconAddress = 'DE:59:85:F2:EB:E9';
      const beaconRSSI = -90;
      const beaconMaxRSSI = -72;

	  	repository.lostBeacon({
	  		bid: [0xc4, 0xa0, 0, 0, 0, 1],
	  		address: beaconAddress,
	  		rssi: beaconRSSI,
	  		rssiMax: beaconMaxRSSI
	  	});

	    assert.strictEqual(server.requests[0].verb, "POST");
	    assert.strictEqual(server.requests[0].url, url);
			assert.notStrictEqual(server.requests[0].content, null);

			const content = JSON.parse(server.requests[0].content);
	    assert.strictEqual(content.eventType, "lost");
	    assert.strictEqual(content.datetime > 0, true);
	    assert.strictEqual(content.beaconId, beaconId);
	    assert.strictEqual(content.address, beaconAddress);
	    assert.strictEqual(content.rssi, beaconRSSI);
	    assert.strictEqual(content.rssiMax, beaconMaxRSSI);
	    assert.strictEqual(content.token, token);
	  });
	});

  describe("Automatic hello messages not sent when not authorized", function() {
  	let repository = null;

  	// Automatic sending of hello messages is triggered when the repository is created
  	// In the test environment the messages are sent every 0.5 seconds

	  before(function(done) {
	  	localStorage.clear();
	    server.initialize();
	    network.online = true;
  	  repository = new Repository(baseURL, 1000);
	    setTimeout(function() {
	    	done();
	    }, 1500)
	  });

	  after(function() {
	  	repository._stopTimer();
	  });

	  it('Doesn\'t send any hello messages', function() {
	  	assert.strictEqual(server.requests.length, 0);
	  });

	});

  describe("Automatic hello messages are sent as soon as authorized", function() {
  	let repository = null;

  	// Automatic sending of hello messages is triggered when the repository is created
  	// In the test environment the messages are sent every 0.5 seconds

	  before(function() {
  		localStorage.clear();
	    server.initialize();
	    network.online = true;
  	  repository = new Repository(baseURL, 1000);
	  });

	  after(function() {
	  	repository._stopTimer();
	  });

	  it('Sends hello messages after authorization', function(done) {
	  	const url = baseURL + "authorize";
	  	const email = "test@etive.org";
	  	const json = JSON.stringify({token: token});

	  	server.respondWith("POST", url, [201, json]);

	  	repository.authorize(email);

	    server.respond();

	    setTimeout(function() {
	  		assert.strictEqual(repository._token, token);
	  	  assert.notStrictEqual(repository._timer, null);
		  	assert.strictEqual(server.requests.length, 1);
		  	let content = JSON.parse(server.requests[0].content);
		  	assert.strictEqual(content.eventType, "hello");
	    	done();
	    }, 1500);
	  });
	});

	 describe("Automatic hello messages sent immediately if already authorized", function() {
  	let repository = null;

  	// Automatic sending of hello messages is triggered when the repository is created
  	// In the test environment the messages are sent every 0.5 seconds

	  before(function(done) {
	    server.initialize();
	    network.online = true;
	    localStorage.setItem(tokenKey, token);
  	  repository = new Repository(baseURL, 1000);
	    setTimeout(function() {
	    	done();
	    }, 1500)
	  });

	  after(function() {
	  	repository._stopTimer();
	  });

	  it('Sends hello messages on instantiation', function() {
	  	assert.strictEqual(repository._token, token);
	  	assert.notStrictEqual(repository._timer, null);
	  	assert.strictEqual(server.requests.length, 1);
	  	let content = JSON.parse(server.requests[0].content);
	  	assert.strictEqual(content.eventType, "hello");
	  });
	});
});