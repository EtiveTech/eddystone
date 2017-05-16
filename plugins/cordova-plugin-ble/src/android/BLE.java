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

public class BLE extends CordovaPlugin implements LeScanCallback
{
	// ************* BLE CENTRAL ROLE *************

	// Implementation of BLE Central API.

	private static final int PERMISSION_REQUEST_COARSE_LOCATION = 1;
	private static final int ACTIVITY_REQUEST_ENABLE_BLUETOOTH = 1;
	private static final int ACTIVITY_REQUEST_ENABLE_LOCATION = 2;

	// Used by startScan().
	private CallbackContext mScanCallbackContext = null;
	private CordovaArgs mScanArgs;

	// The Android application Context.
	private Context mContext;

	private boolean mRegisteredReceivers = false;

	// Called when the device's Bluetooth powers on.
	// Used by startScan() to wait for power-on if Bluetooth was
	// off when the function was called.
	private Runnable mOnPowerOn;

	// Used to send error messages to the JavaScript side if Bluetooth power-on fails.
	private CallbackContext mPowerOnCallbackContext;

	private void runAction(Runnable action)
	{
		// Original method, call directly.
		//action.run();

		// Possibly safer alternative, call on UI thread.
		cordova.getActivity().runOnUiThread(action);

		// See issue: https://github.com/evothings/cordova-ble/issues/122
		// Some links:
		//http://stackoverflow.com/questions/28894111/android-ble-gatt-error133-on-connecting-to-device
		//http://stackoverflow.com/questions/20839018/while-connecting-to-ble113-from-android-4-3-is-logging-client-registered-waiti/23478737#23478737
		// http://stackoverflow.com/questions/23762278/status-codes-132-and-133-from-ble112

	}

	// Called each time cordova.js is loaded.
	@Override
	public void initialize(final CordovaInterface cordova, CordovaWebView webView) {
		super.initialize(cordova, webView);

		mContext = webView.getContext();

		if (!mRegisteredReceivers) {
			mContext.registerReceiver(
				new BluetoothStateReceiver(),
				new IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED));

			mRegisteredReceivers = true;
		}
	}

	// Handles JavaScript-to-native function calls.
	// Returns true if a supported function was called, false otherwise.
	@Override
	public boolean execute(String action, CordovaArgs args, final CallbackContext callbackContext) {
		try {
			// Central API
			if ("startScan".equals(action)) {
				startScan(args, callbackContext);
			}
			else if ("stopScan".equals(action)) {
				stopScan(args, callbackContext);
			}
			else {
				return false;
			}
		}
		catch (JSONException e) {
			e.printStackTrace();
			callbackContext.error(e.getMessage());
			return false;
		}

		return true;
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
		if (mScanCallbackContext != null) {
			BluetoothAdapter a = BluetoothAdapter.getDefaultAdapter();
			a.stopLeScan(this);
			mScanCallbackContext = null;
		}
		if (mConnectedDevices != null) {
			Iterator<GattHandler> itr = mConnectedDevices.values().iterator();
			while (itr.hasNext()) {
				GattHandler gh = itr.next();
				if (gh.mGatt != null)
					gh.mGatt.close();
			}
			mConnectedDevices.clear();
		}
		if (mGattServer != null) {
			mGattServer.close();
			mGattServer = null;
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
			runAction(onPowerOn);
		}
		else {
			mOnPowerOn = onPowerOn;
			mPowerOnCallbackContext = cc;
			Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
			cordova.startActivityForResult(this, enableBtIntent, ACTIVITY_REQUEST_ENABLE_BLUETOOTH);
		}
	}

	// Called when the Bluetooth power-on request is completed.
	@Override
	public void onActivityResult(int requestCode, int resultCode, Intent intent) {
		if (ACTIVITY_REQUEST_ENABLE_BLUETOOTH == requestCode) {
			Runnable onPowerOn = mOnPowerOn;
			CallbackContext cc = mPowerOnCallbackContext;
			mOnPowerOn = null;
			mPowerOnCallbackContext = null;
			if (resultCode == Activity.RESULT_OK) {
				if (null != onPowerOn) {
					runAction(onPowerOn);
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
			if (isSystemLocationEnabled(mContext)) {
				// All prerequisites ok, go ahead and start scanning.
				startScanImpl(mScanArgs, mScanCallbackContext);
			}
			else {
				// System Location is off, send callback error.
				mScanCallbackContext.error("System Location is off");
				mScanCallbackContext = null;
			}
		}
	}

	// These three functions each send a JavaScript callback *without* removing
	// the callback context, as is default.

	private void keepCallback(final CallbackContext callbackContext, JSONObject message) {
		PluginResult r = new PluginResult(PluginResult.Status.OK, message);
		r.setKeepCallback(true);
		if (callbackContext != null) {
			callbackContext.sendPluginResult(r);
		}
	}

	private void keepCallback(final CallbackContext callbackContext, String message) {
		PluginResult r = new PluginResult(PluginResult.Status.OK, message);
		r.setKeepCallback(true);
		if (callbackContext != null) {
			callbackContext.sendPluginResult(r);
		}
	}

	private void keepCallback(final CallbackContext callbackContext, byte[] message) {
		PluginResult r = new PluginResult(PluginResult.Status.OK, message);
		r.setKeepCallback(true);
		if (callbackContext != null) {
			callbackContext.sendPluginResult(r);
		}
	}

	// API implementation. See ble.js for documentation.
	private void startScan(final CordovaArgs args, final CallbackContext callbackContext) {
		// Scanning must not be in progress.
		if (mScanCallbackContext != null) return;

		// Save callback context.
		mScanCallbackContext = callbackContext;
		mScanArgs = args;

		// Check permissions needed for scanning, starting with
		// application location permission.
		startScanCheckApplicationLocationPermission();
	}

	// Callback from cordova.requestPermission().
	@Override
	public void onRequestPermissionResult(int requestCode, String[] permissions, int[] grantResults) throws JSONException {
		if (PERMISSION_REQUEST_COARSE_LOCATION == requestCode) {
			if (PackageManager.PERMISSION_GRANTED == grantResults[0]) {
				// Permission ok, check system location setting.
				startScanCheckSystemLocationSetting();
			}
			else {
				// Permission NOT ok, send callback error.
				mScanCallbackContext.error("Location permission not granted");
				mScanCallbackContext = null;
			}
		}
	}

	private void startScanCheckApplicationLocationPermission() {
		// Location permission check.
		if (cordova.hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION)) {
			// Location permission ok, next check system location setting.
			startScanCheckSystemLocationSetting();
		}
		else {
			// Location permission needed. Ask user.
			cordova.requestPermission(this, PERMISSION_REQUEST_COARSE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION);
		}
	}

	private void startScanCheckSystemLocationSetting()
	{
		// If below Marshmallow System Location setting does not need to be on.
		if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
			// Go ahead and start scanning.
			startScanImpl(mScanArgs, mScanCallbackContext);
			return;
		}

		// We are on Marshmallow or higher, check/ask for System Location to be enabled.
		if (isSystemLocationEnabled(mContext)) {
			// All prerequisites ok, now we can go ahead and start scanning.
			startScanImpl(mScanArgs, mScanCallbackContext);
		}
		else {
			// Ask user to enable system location.
			// TODO: Make it possible to set strings from JavaScript (for localisation).
			AlertDialog.Builder builder = new AlertDialog.Builder(mContext);
			builder.setTitle("Please enable Location in System Settings");
			builder.setMessage("Location setting needs to be turned On for Bluetooth scanning to work");
			final CordovaPlugin self = this;
			builder.setPositiveButton(
				"Open System Settings",
				new DialogInterface.OnClickListener() {
					public void onClick(DialogInterface dialogInterface, int i) {
						Intent enableLocationIntent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
						cordova.startActivityForResult(
							self,
							enableLocationIntent,
							ACTIVITY_REQUEST_ENABLE_LOCATION);
					}
				});
			builder.setNegativeButton(
				"Cancel",
				new DialogInterface.OnClickListener() {
					public void onClick(DialogInterface dialogInterface, int i) {
						// Permission NOT ok, send callback error.
						mScanCallbackContext.error("System Location is off");
						mScanCallbackContext = null;
					}
				});
			builder.create().show();
		}
	}

	private boolean isSystemLocationEnabled(Context context) {
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
			try {
				int locationMode = Settings.Secure.getInt(
					context.getContentResolver(),
					Settings.Secure.LOCATION_MODE);
				return locationMode != Settings.Secure.LOCATION_MODE_OFF;
			}
			catch (SettingNotFoundException e) {
				e.printStackTrace();
				return false;
			}
		}
		else {
			String locationProviders = Settings.Secure.getString(
				context.getContentResolver(),
				Settings.Secure.LOCATION_PROVIDERS_ALLOWED);
			return !TextUtils.isEmpty(locationProviders);
		}
	}

	private void startScanImpl(final CordovaArgs args, final CallbackContext callbackContext) {
		final BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
		final LeScanCallback self = this;

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
				if (!adapter.startLeScan(serviceUUIDs, self)) {
					callbackContext.error("Android function startLeScan failed");
					mScanCallbackContext = null;
				}
			}
		});
	}

	// Called during scan, when a device advertisement is received.
	public void onLeScan(BluetoothDevice device, int rssi, byte[] scanRecord) {
		if (mScanCallbackContext == null) return;

		try {
			//Log.i("@@@@@@", "onLeScan "+device.getAddress()+" "+rssi+" "+device.getName());
			JSONObject jsonObject = new JSONObject();
			jsonObject.put("address", device.getAddress());
			jsonObject.put("rssi", rssi);
			jsonObject.put("name", device.getName());
			jsonObject.put("scanRecord", Base64.encodeToString(scanRecord, Base64.NO_WRAP));
			keepCallback(mScanCallbackContext, jsonObject);
		}
		catch(JSONException e) {
			mScanCallbackContext.error(e.toString());
		}
	}

	// API implementation.
	private void stopScan(final CordovaArgs args, final CallbackContext callbackContext) {
		// No pending scan results will be reported.
		mScanCallbackContext = null;

		final BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
		final BluetoothAdapter.LeScanCallback callback = this;

		// Call stopLeScan without checking if bluetooth is on.
		adapter.stopLeScan(callback);

		/*
		// TODO: Since there is no callback given to stopScan, there can be other
		// calls (typically startScan) that are called before the BLE enable dialog
		// is closed, causing BLE enabling to be aborted. We therefore call stopLeScan
		// directly, without checking if BLE is on. It would be better design to queue
		// calls, and to also add callbacks for stopScan (and also to close).
		// All operations that are not related to a device should be queued
		// (the operations for a device are already queued, but close is
		// missing callbacks).
		checkPowerState(adapter, callbackContext, new Runnable()
		{
			@Override
			public void run()
			{
				adapter.stopLeScan(callback);
			}
		});
		*/
	}
