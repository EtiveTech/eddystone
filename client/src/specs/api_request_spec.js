"use strict"

process.env.NODE_ENV = 'test';

const sinon = require('sinon');
const assert = require("assert");
const ApiRequest = require('../network/api_request');
const network = require('../stubs').network;
const server = require('../stubs').HttpServer;
const baseURL = "https://cj101d.ifdnrg.com/";


describe("API Request", function() {

  var apiRequest;

  describe("All Request Types", function() {

    beforeEach(function() {
      server.initialize();
      apiRequest = new ApiRequest();
      network.online = true;
    });

    it("Create a GET Request", function () {
      const url = baseURL + "beacon-log";

      apiRequest.makeGetRequest(url, false, function(){});

      assert.strictEqual(server.requests[0].verb, "GET");
      assert.strictEqual(server.requests[0].url, url);
      assert.strictEqual(server.requests[0].content, null);
    });

    it("Make a GET Request", function () {
      const url = baseURL + "beacon-log";
      const json = JSON.stringify({
        type: 'found',
        datetime: new Date().toISOString(),
        beaconId: 'c4a000000001',
        address: 'DE:59:85:F2:EB:E9',
        RSSI: -90,
        txPower: -72,
        email: 'test@etive.org',
        key: '0000-000-000000'
      });
      const callback = sinon.spy();

      server.respondWith("GET", url, [200, json]);

      apiRequest.makeGetRequest(url, false, callback);

      server.respond(); // Process all requests so far

      assert.strictEqual(callback.callCount, 1);
      const call = callback.getCall(0);
      assert.strictEqual(call.args[0], 200);
      assert.deepStrictEqual(call.args[1], JSON.parse(json));
    });

    it("Can reset a GET Request", function() {
      const url = baseURL + "beacon-log";
      const json = JSON.stringify({
        type: 'found',
        datetime: new Date().toISOString(),
        beaconId: 'c4a000000001',
        address: 'DE:59:85:F2:EB:E9',
        RSSI: -90,
        txPower: -72,
        email: 'test@etive.org',
        key: '0000-000-000000'
      });
      const callback = sinon.spy();

      server.respondWith("GET", url, [200, json]);

      apiRequest.makeGetRequest(url, false, callback);
      apiRequest._resetRequest()._send();

      assert.strictEqual(server.requests.length, 2);
      server.respond(); // Process all requests so far
      assert.strictEqual(callback.callCount, 2);
      let call = callback.getCall(0);
      assert.strictEqual(call.args[0], 200);
      assert.deepStrictEqual(call.args[1], JSON.parse(json));
      call = callback.getCall(1);
      assert.strictEqual(call.args[0], 200);
      assert.deepStrictEqual(call.args[1], JSON.parse(json));
    });

    it("Create a POST Request", function () {
      const url = baseURL + "beacon-log";
      const params = {
        type: 'found',
        datetime: new Date().toISOString(),
        beaconId: 'c4a000000001',
        address: 'DE:59:85:F2:EB:E9',
        RSSI: -90,
        txPower: -72,
        email: 'test@etive.org',
        key: '0000-000-000000'
      };
      const json = JSON.stringify(params);

      apiRequest.makePostRequest(url, params, false, function(){});

      assert.strictEqual(server.requests[0].verb, "POST");
      assert.strictEqual(server.requests[0].url, url);
      assert.strictEqual(server.requests[0].content, json);
      assert.deepStrictEqual(server.requests[0].headers, { 'Content-Type': 'application/json' });
    });

    it("Make a POST Request", function () {
      const url = baseURL + "beacon-log";
      const params = {
        type: 'found',
        datetime: new Date().toISOString(),
        beaconId: 'c4a000000001',
        address: 'DE:59:85:F2:EB:E9',
        RSSI: -90,
        txPower: -72,
        email: 'test@etive.org',
        key: '0000-000-000000'
      };
      const json = JSON.stringify(params);
      const callback = sinon.spy();

      server.respondWith("POST", url, [201, json]);

      apiRequest.makePostRequest(url, params, false, callback);

      server.respond(); // Process all requests so far

      assert.strictEqual(callback.callCount, 1);
      const call = callback.getCall(0);
      assert.strictEqual(call.args[0], 201);
      assert.deepStrictEqual(call.args[1], JSON.parse(json));
    });

    it("Can reset a POST Request", function () {
      const url = baseURL + "beacon-log";
      const params = {
        type: 'found',
        datetime: new Date().toISOString(),
        beaconId: 'c4a000000001',
        address: 'DE:59:85:F2:EB:E9',
        RSSI: -90,
        txPower: -72,
        email: 'test@etive.org',
        key: '0000-000-000000'
      };
      const json = JSON.stringify(params);
      const callback = sinon.spy();

      server.respondWith("POST", url, [201, json]);

      apiRequest.makePostRequest(url, params, false, callback);
      apiRequest._resetRequest()._send();

      assert.strictEqual(server.requests.length, 2);
      server.respond(); // Process all requests so far
      assert.strictEqual(callback.callCount, 2);
      let call = callback.getCall(0);
      assert.strictEqual(call.args[0], 201);
      assert.deepStrictEqual(call.args[1], JSON.parse(json));
      call = callback.getCall(1);
      assert.strictEqual(call.args[0], 201);
      assert.deepStrictEqual(call.args[1], JSON.parse(json));
    });

    it("Create a PUT Request", function () {
      const url = baseURL + "beacon-log/5";
      const params = {
        type: 'found',
        datetime: new Date().toISOString(),
        beaconId: 'c4a000000001',
        address: 'DE:59:85:F2:EB:E9',
        RSSI: -90,
        txPower: -72,
        email: 'test@etive.org',
        key: '0000-000-000000'
      };

      apiRequest.makePutRequest(url, params, false, function(){});

      assert.strictEqual(server.requests[0].verb, "PUT");
      assert.strictEqual(server.requests[0].url, url);
      assert.strictEqual(server.requests[0].content, JSON.stringify(params));
    });

    it("Make a PUT Request", function () {
      const url = baseURL + "beacon-log/5";
      const params = {
        type: 'found',
        datetime: new Date().toISOString(),
        beaconId: 'c4a000000001',
        address: 'DE:59:85:F2:EB:E9',
        RSSI: -90,
        txPower: -72,
        email: 'test@etive.org',
        key: '0000-000-000000'
      };
      const json = JSON.stringify(params);
      const callback = sinon.spy();

      server.respondWith("PUT", url, [201, json]);

      apiRequest.makePutRequest(url, params, false, callback);

      server.respond();

      assert.strictEqual(callback.callCount, 1);
      const call = callback.getCall(0);
      assert.strictEqual(call.args.length, 2);
      assert.strictEqual(call.args[0], 201);
      assert.deepStrictEqual(call.args[1], JSON.parse(json));
    });

    it("Can reset a PUT Request", function () {
      const url = baseURL + "beacon-log/5";
      const params = {
        type: 'found',
        datetime: new Date().toISOString(),
        beaconId: 'c4a000000001',
        address: 'DE:59:85:F2:EB:E9',
        RSSI: -90,
        txPower: -72,
        email: 'test@etive.org',
        key: '0000-000-000000'
      };
      const json = JSON.stringify(params);
      const callback = sinon.spy();

      server.respondWith("PUT", url, [201, json]);

      apiRequest.makePutRequest(url, params, false, callback);
      apiRequest._resetRequest()._send();

      assert.strictEqual(server.requests.length, 2);
      server.respond();
      assert.strictEqual(callback.callCount, 2);
      let call = callback.getCall(0);
      assert.strictEqual(call.args.length, 2);
      assert.strictEqual(call.args[0], 201);
      assert.deepStrictEqual(call.args[1], JSON.parse(json));
      call = callback.getCall(1);
      assert.strictEqual(call.args.length, 2);
      assert.strictEqual(call.args[0], 201);
      assert.deepStrictEqual(call.args[1], JSON.parse(json));
    });

    it("Create a DELETE Request", function () {
      const url = baseURL + "beacon-log/5";

      apiRequest.makeDeleteRequest(url, false, function(){});

      assert.strictEqual(server.requests[0].verb, "DELETE");
      assert.strictEqual(server.requests[0].url, url);
      assert.strictEqual(server.requests[0].content, null);
    });

    it("Make a DELETE Request", function () {
      const url = baseURL + "beacon-log/5";
      const callback = sinon.spy();

      server.respondWith("DELETE", url, [204]);

      apiRequest.makeDeleteRequest(url, false, callback);

      server.respond(); // Process all requests so far

      assert.strictEqual(callback.callCount, 1);
      const call = callback.getCall(0);
      assert.strictEqual(call.args.length, 2);
      assert.strictEqual(call.args[0], 204);
      assert.strictEqual(call.args[1], null);
    });

    it("Can reset a DELETE Request", function () {
      const url = baseURL + "beacon-log/5";
      const callback = sinon.spy();

      server.respondWith("DELETE", url, [204]);

      apiRequest.makeDeleteRequest(url, false, callback);
      apiRequest._resetRequest()._send();

      assert.strictEqual(server.requests.length, 2);
      server.respond(); // Process all requests so far
      assert.strictEqual(callback.callCount, 2);
      let call = callback.getCall(0);
      assert.strictEqual(call.args.length, 2);
      assert.strictEqual(call.args[0], 204);
      assert.strictEqual(call.args[1], null);
      call = callback.getCall(1);
      assert.strictEqual(call.args.length, 2);
      assert.strictEqual(call.args[0], 204);
      assert.strictEqual(call.args[1], null);
    });
  });
});
