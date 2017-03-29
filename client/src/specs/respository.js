"use strict"

process.env.NODE_ENV = 'test';

const sinon = require('sinon');
const assert = require("assert");
const Repository = require('../network/repository');
const network = require('../stubs').network;
const server = require('../stubs').HttpServer;

const baseURL = "https://cj101d.ifdnrg.com/";
const beaconLog = "beacon-log";

describe("Repository Request", function() {
	const repository = new Repository(baseURL);

  describe("All Request Types", function() {

	  beforeEach(function() {
	    server.initialize();
	    network.online = true;
	  });

	  it('Creates a request without authorisation', function() {
	  	const url = baseURL + "/" + beaconLog;

	  	repository.hello();

	    assert.strictEqual(server.requests[0].verb, "POST");
	    assert.strictEqual(server.requests[0].url, url);
			assert.notStrictEqual(server.requests[0].content, null);

			const content = JSON.parse(server.requests[0].content);
	    assert.strictEqual(content['type'], "hello");
	    assert.strictEqual(content.token, null);
	    assert.strictEqual(isNaN(Date.parse(content.datetime)), false);
	  });
	});
});