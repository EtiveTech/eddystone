"use strict"

const maxFileSize = 65536;

const Logger = function() {
	this._initialised = false;
	this._logToConsole = true;
	this._logToFile = false;
	this._logFilename = "";
	this._fileWriter = null;
	this._isWriting = false;
	this._buffer = "";
}

Logger.prototype.initialise = function(options, onCompleted) {

	if (this._initialised) return;

  this._logToConsole = options.console;
  this._logToFile = options.file;

  if (this._logToFile && !this._fileWriter) {
  	this._logFilename = this._getFilename();
    window.resolveLocalFileSystemURL(cordova.file.externalDataDirectory, function (dir) {
      dir.getFile(this._logFilename, {create:true}, function(file) {
        file.createWriter(function (fileWriter) {
        	if (this._logToConsole) console.log("Created log file " + this._logFilename)
        	this._fileWriter = fileWriter;
        	this._fileWriter.onwriteend = this._doneWriting.bind(this);
        	this._fileWriter.seek(this._fileWriter.length);
        }.bind(this));
        this._initComplete(onCompleted);
      }.bind(this));
    }.bind(this));
  }
  else {
    this._initComplete(onCompleted);
  }
}

Logger.prototype._initComplete = function(onCompleted) {
		this._initialised = true;
		onCompleted();
};

Logger.prototype.log = function() {
  if (this._logToConsole || this._logToFile) {
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

    if (this._logToConsole) console.log(text);
    if (this._logToFile) this._writeToFile(text + "\n");
  }
}

Logger.prototype._writeToFile = function(text) {
	if (!this._fileWriter) return;
  if (this._fileWriter.length + this._buffer.length >= maxFileSize) return;

	if (this._isWriting) {
		this._buffer += text;
	}
	else {
		this._isWriting = true;
		const blob = new Blob([text], { type: 'text/plain' });
		this._fileWriter.write(blob);
	}
}

Logger.prototype._doneWriting = function() {
	if (!this._fileWriter) return;

	this._isWriting = false;
	if (this._buffer) {
		this._isWriting = true;
		const blob = new Blob([this._buffer], { type: 'text/plain' });
		this._buffer = "";
		this._fileWriter.write(blob);
	}
}

Logger.prototype._getFilename = function() {
	const datetime = new Date();
	const datetimeString = datetime.toISOString().slice(0, -5); // remove the trailing 'Z' and the millisecond count 
	let parts = datetimeString.split('T');
	const filename = "city4age." + parts[0].replace(/-/g, '') + '.' + parts[1].replace(/:/g, '') + '.log';
	return filename;
}

const logger = new Logger(); // Singleton

module.exports = logger;