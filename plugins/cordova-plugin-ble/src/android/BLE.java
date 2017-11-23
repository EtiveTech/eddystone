/*
Copyright 2014 Evothings AB

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package com.evothings;

import org.apache.cordova.*;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import android.bluetooth.*;
import android.bluetooth.le.*;
import android.bluetooth.BluetoothAdapter.LeScanCallback;
import android.content.*;
import android.app.Activity;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;
import java.util.Iterator;
import java.util.UUID;
import java.util.ArrayList;
import java.io.UnsupportedEncodingException;
import java.lang.reflect.*;
import android.util.Base64;
import android.os.ParcelUuid;
import android.util.Log;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.Manifest;
import android.provider.Settings;
import android.provider.Settings.SettingNotFoundException;
import android.app.AlertDialog;
import android.text.TextUtils;

public class BLE extends CordovaPlugin {
	// ************* BLE CENTRAL ROLE *************

	// Implementation of BLE Central API.

	private static final int PERMISSION_REQUEST_COARSE_LOCATION = 1;
	private static final int ACTIVITY_REQUEST_ENABLE_BLUETOOTH = 1;
	private static final int ACTIVITY_REQUEST_ENABLE_LOCATION = 2;

	// Used by startScan().
	private CallbackContext scanCallbackContext = null;
	private JSONArray scanArgs;
	private BluetoothAdapter adapter;

	// The Android application Context.
	private Context context;

	private boolean registeredReceivers = false;

	// Called when the device's Bluetooth powers on.
	// Used by startScan() to wait for power-on if Bluetooth was
	// off when the function was called.
	private Runnable onPowerOn;

	// Used to send error messages to the JavaScript side if Bluetooth power-on fails.
	private CallbackContext powerCallbackContext;

	private LeScanCallback leScanCallback = new LeScanCallback() {
		// Called during scan, when a device advertisement is received.
		// scanrecord is the content of the advertisement record offered by the remote device.
		@Override
		public void onLeScan(BluetoothDevice device, int rssi, byte[] scanRecord) {
			CallbackContext callbackContext = getScanCallbackContext();
			if (callbackContext == null) return;

			try {
				//Log.i("@@@@@@", "onLeScan "+device.getAddress()+" "+rssi+" "+device.getName());
				JSONObject jsonObject = new JSONObject();
				jsonObject.put("address", device.getAddress());
				jsonObject.put("rssi", rssi);
				jsonObject.put("name", device.getName());
				jsonObject.put("scanRecord", Base64.encodeToString(scanRecord, Base64.NO_WRAP));
				// Send result
				PluginResult r = new PluginResult(PluginResult.Status.OK, jsonObject);
				r.setKeepCallback(true);
				if (callbackContext != null) {
					callbackContext.sendPluginResult(r);
				}
			}
			catch(JSONException e) {
				callbackContext.error(e.toString());
			}
		}
	};

	private ScanCallback scanCallback = new ScanCallback() {
    @Override
    public void onScanResult(int callbackType, ScanResult result) {
    	CallbackContext callbackContext = getScanCallbackContext();
			if (callbackContext == null) return;

			ScanRecord scanRecord = result.getScanRecord();
	    if (scanRecord == null) return;

	    if (callbackType != ScanSettings.CALLBACK_TYPE_ALL_MATCHES) {
	        // Should not happen.
	        callbackContext.error("LE Scan has already started");
	        return;
	    }

			try {
				BluetoothDevice device = result.getDevice();
				JSONObject jsonObject = new JSONObject();
				jsonObject.put("address", device.getAddress());
				jsonObject.put("rssi", result.getRssi());
				jsonObject.put("name", device.getName());
				jsonObject.put("scanRecord", Base64.encodeToString(scanRecord.getBytes(), Base64.NO_WRAP));
				// Send result
				PluginResult r = new PluginResult(PluginResult.Status.OK, jsonObject);
				r.setKeepCallback(true);
				if (callbackContext != null) {
					callbackContext.sendPluginResult(r);
				}
			}
			catch(JSONException e) {
				callbackContext.error(e.toString());
			}
		}
	};

	private CallbackContext getScanCallbackContext() {
		return this.scanCallbackContext;
	}

	private void setScanCallbackContext(CallbackContext callbackContext) {
		this.scanCallbackContext = callbackContext;
	}

	private void unsetScanCallbackContext() {
		this.scanCallbackContext = null;
	}

	private LeScanCallback getLeScanCallback() {
		return this.leScanCallback;
	}

	private ScanCallback getScanCallback() {
		return this.scanCallback;
	}

	// Called each time cordova.js is loaded.
	@Override
	public void initialize(final CordovaInterface cordova, CordovaWebView webView) {
		super.initialize(cordova, webView);

		this.context = webView.getContext();

		if (!this.registeredReceivers) {
			this.context.registerReceiver(
				new BluetoothStateReceiver(),
				new IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED));

			this.registeredReceivers = true;
		}
	}

	// Handles JavaScript-to-native function calls.
	// Returns true if a supported function was called, false otherwise.
	@Override
	public boolean execute(String action, JSONArray args, final CallbackContext callbackContext) throws JSONException {
		// Central API
		if (action.equals("startScan")) {
			// Don't attempt to start scanning if there is a scan in progress
			if (getScanCallbackContext() != null) return true;

			// Save callback context.
			setScanCallbackContext(callbackContext);
			this.scanArgs = args;

			// Check permissions needed for scanning: Application location permission and system location setting.
			if (hasLocationPermission() && isLocationEnabled()) {
				// This is the "normal" route through the code
				// startLeScanning(args, callbackContext);
				startScanning(args, callbackContext);
			}
			else {
				// Don't have permission to start the scan immediately
				// Check for permission to use the location service first
				if (!hasLocationPermission()) {
					// This will call back to onRequestPermissionResult()
					cordova.requestPermission(this, PERMISSION_REQUEST_COARSE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION);
				}
				else {
					// Have permission to use the service but it isn't turned on - ask for it to be turned on
					// This will call back to onActivityResult()
					enableLocation();
				}
			}

			return true;
		}

		if (action.equals("stopScan")) {
			// No pending scan results will be reported.
			unsetScanCallbackContext();

			final BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
			final BluetoothLeScanner scanner = adapter.getBluetoothLeScanner();

			// Call stopLeScan without checking if bluetooth is on.
			// adapter.stopLeScan(getLeScanCallback());
			scanner.stopScan(getScanCallback());

			return true;
		}

		return false; // Method not found
	}

	/**
	* Called when the WebView does a top-level navigation or refreshes.
	*
	* Plugins should stop any long-running processes and clean up internal state.
	*
	* Does nothing by default.
	*
	* Our version should stop any ongoing scan, and close any existing connections.
	*/
	@Override
	public void onReset() {
		if (getScanCallbackContext() != null) {
			BluetoothAdapter a = BluetoothAdapter.getDefaultAdapter();
			a.stopLeScan(getLeScanCallback());
			unsetScanCallbackContext();
		}
	}

	// Callback from cordova.requestPermission().
	@Override
	public void onRequestPermissionResult(int requestCode, String[] permissions, int[] grantResults) throws JSONException {
		if (PERMISSION_REQUEST_COARSE_LOCATION == requestCode) {
			if (PackageManager.PERMISSION_GRANTED == grantResults[0]) {
				// Permission ok, check system location setting.
				if (isLocationEnabled()) {
					startLeScanning(this.scanArgs, getScanCallbackContext());
				}
				else {
					// A callback will start the scan if it can
					enableLocation();
				}
			}
			else {
				// Permission NOT ok, send callback error.
				getScanCallbackContext().error("Location permission not granted");
				unsetScanCallbackContext();
			}
		}
	}

		// Called when the Bluetooth power-on request is completed.
	@Override
	public void onActivityResult(int requestCode, int resultCode, Intent intent) {
		if (ACTIVITY_REQUEST_ENABLE_BLUETOOTH == requestCode) {
			Runnable onPowerOn = this.onPowerOn;
			CallbackContext cc = this.powerCallbackContext;
			this.onPowerOn = null;
			this.powerCallbackContext = null;
			if (resultCode == Activity.RESULT_OK) {
				if (null != onPowerOn) {
					cordova.getThreadPool().execute(onPowerOn);
				}
				else {
					// Runnable was null.
					if (null != cc) cc.error("Runnable is null in onActivityResult (internal error)");
				}
			}
			else {
				if (resultCode == Activity.RESULT_CANCELED) {
					if (null != cc) cc.error("Bluetooth power-on cancelled");
				}
				else {
					if (null != cc) cc.error("Bluetooth power-on failed with code: "+resultCode);
				}
			}
		}
		else if (ACTIVITY_REQUEST_ENABLE_LOCATION == requestCode) {
			if (isSystemLocationEnabled(this.context)) {
				// All prerequisites ok, go ahead and start scanning.
				startLeScanning(this.scanArgs, getScanCallbackContext());
			}
			else {
				// System Location is off, send callback error.
				getScanCallbackContext().error("System Location is off");
				unsetScanCallbackContext();
			}
		}
	}

	// Possibly asynchronous.
	// Ensures Bluetooth is powered on, then calls the Runnable \a onPowerOn.
	// Calls cc.error if power-on fails.
	private void checkPowerState(BluetoothAdapter adapter, CallbackContext cc, Runnable onPowerOn) {
		if (adapter == null) {
			cc.error("Bluetooth not supported");
			return;
		}
		if (adapter.getState() == BluetoothAdapter.STATE_ON) {
			// Bluetooth is ON
			cordova.getThreadPool().execute(onPowerOn);
		}
		else {
			this.onPowerOn = onPowerOn;
			this.powerCallbackContext = cc;
			Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
			cordova.startActivityForResult(this, enableBtIntent, ACTIVITY_REQUEST_ENABLE_BLUETOOTH);
		}
	}

	private void enableLocation() {
		// Create a dialog box to ask user to enable system location.
		AlertDialog.Builder builder = new AlertDialog.Builder(this.context);
		builder.setTitle("Please enable Location in System Settings");
		builder.setMessage("Location setting needs to be turned On for Bluetooth scanning to work");
		final CordovaPlugin self = this;
		builder.setPositiveButton(
				"Open System Settings",
				new DialogInterface.OnClickListener() {
					public void onClick(DialogInterface dialogInterface, int i) {
						Intent enableLocationIntent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
						cordova.startActivityForResult(self, enableLocationIntent, ACTIVITY_REQUEST_ENABLE_LOCATION);
					}
				});
		builder.setNegativeButton(
				"Cancel",
				new DialogInterface.OnClickListener() {
					public void onClick(DialogInterface dialogInterface, int i) {
						// Permission NOT ok, send callback error.
						getScanCallbackContext().error("System Location is off");
						unsetScanCallbackContext();
					}
				});
		builder.create().show();	
	}

	private boolean isSystemLocationEnabled(Context context) {
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
			try {
				int locationMode =
					Settings.Secure.getInt(context.getContentResolver(), Settings.Secure.LOCATION_MODE);
				return locationMode != Settings.Secure.LOCATION_MODE_OFF;
			}
			catch (SettingNotFoundException e) {
				e.printStackTrace();
				return false;
			}
		}
		else {
			String locationProviders =
				Settings.Secure.getString(context.getContentResolver(), Settings.Secure.LOCATION_PROVIDERS_ALLOWED);
			return !TextUtils.isEmpty(locationProviders);
		}
	}

	private boolean isLocationEnabled() {
		// If below Marshmallow System Location setting does not need to be on.
		return ((Build.VERSION.SDK_INT < Build.VERSION_CODES.M) || isSystemLocationEnabled(this.context));
	}
	
	private boolean hasLocationPermission() {
		return (cordova.hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION));
	}

	@Deprecated
	private void startLeScanning(final JSONArray args, final CallbackContext callbackContext) {
		final BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();

		// Get service UUIDs.
		UUID[] uuidArray = null;
		try {
			JSONArray uuids = args.getJSONArray(0);
			if (null != uuids) {
				uuidArray = new UUID[uuids.length()];
				for (int i = 0; i < uuids.length(); ++i) {
					uuidArray[i] = UUID.fromString(uuids.getString(i));
				}
			}
		}
		catch(JSONException ex) {
			uuidArray = null;
		}

		final UUID[] serviceUUIDs = uuidArray;

		checkPowerState(adapter, callbackContext, new Runnable() {
			@Override
			public void run() {
				boolean scanStarted = adapter.startLeScan(serviceUUIDs, getLeScanCallback());
				if (!scanStarted) {
					callbackContext.error("Android function startLeScan failed");
					unsetScanCallbackContext();
				}
			}
		});
	}

	private void startScanning(final JSONArray args, final CallbackContext callbackContext) {
		final BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
		final BluetoothLeScanner scanner = adapter.getBluetoothLeScanner();

	    if (scanner == null) {
	        callbackContext.error("Cannot get BluetoothLeScanner");
	        return;
	    }

		ScanSettings settings = new ScanSettings.Builder()
		    .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
		    .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build();

		// Get service UUIDs.
		UUID[] serviceUUIDs= null;
		try {
			JSONArray uuids = args.getJSONArray(0);
			if (null != uuids) {
				serviceUUIDs = new UUID[uuids.length()];
				for (int i = 0; i < uuids.length(); ++i) {
					serviceUUIDs[i] = UUID.fromString(uuids.getString(i));
				}
			}
		}
		catch(JSONException ex) {
			serviceUUIDs = null;
		}

		List<ScanFilter> filters = new ArrayList<ScanFilter>();
		if (serviceUUIDs != null && serviceUUIDs.length > 0) {
		    // Note scan filter does not support matching an UUID array so we put one
		    // UUID to hardware and match the whole array in callback.
		    ScanFilter filter =
		    	new ScanFilter.Builder().setServiceUuid(new ParcelUuid(serviceUUIDs[0])).build();
		    filters.add(filter);
		}

		scanner.startScan(filters, settings, getScanCallback());
	}

	private class BluetoothStateReceiver extends BroadcastReceiver {
		public void onReceive(Context context, Intent intent) {
			BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
			int state = adapter.getState();
			CallbackContext callbackContext = getScanCallbackContext();
			if (callbackContext != null) {
				// Device is scanning - has Bluetooth been turned off?
				if (state == BluetoothAdapter.STATE_OFF /* && !adapter.enable() */) {
					callbackContext.error("Bluetooth disabled");
				}
			}
		}
	}
}
