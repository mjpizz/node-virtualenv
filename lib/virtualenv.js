var path = require("path");
var spawn = require("child_process").spawn;
var tar = require("tar");
var zlib = require("zlib");
var rimraf = require("rimraf");
var request = require("request");

function VirtualEnv(packagePath, options) {
  options = options || {};

  // Details come directly from the given package.json
  var package = require(packagePath);
  this._version = package.virtualenv.version;
  this._pythonDeps = package.virtualenv.dependencies;
  this._createFlags = package.virtualenv.flags || [];
  this._virtualenvHome = path.join(path.dirname(packagePath), "node_modules", ".virtualenv");
  this._virtualenvTemp = path.join(path.dirname(packagePath), "node_modules", ".virtualenv-temp");
  this._virtualenvPath = path.join(this._virtualenvTemp, "virtualenv-" + this._version);

  // Allow installation progress to be logged on alternative
  // streams, but default to to stdout and stderr.
  this._stdout = options.stdout || process.stdout;
  this._stderr = options.stderr || process.stderr;

}

VirtualEnv.prototype.install = function install(callback) {
  this._download(function(err) {
    if (err) return callback(err);
    this._create(function(err) {
      if (err) return callback(err);
      this._pip(function(err) {
        if (err) return callback(err);
        this._cleanup(function(err) {
          if (err) return callback(err);
          callback();
        }.bind(this));
      }.bind(this));
    }.bind(this));
  }.bind(this));
}

VirtualEnv.prototype.spawnPython = function spawnPython(args, options) {
  var pathToPython = path.join(this._virtualenvHome, "bin", "python");
  return spawn(pathToPython, args, options);
}

VirtualEnv.prototype.spawn32bitOSXPython = function spawn32bitOSXPython(args, options) {
  var pathToPython = path.join(this._virtualenvHome, "bin", "python");
  return spawn("arch", ["-i386"].concat([pathToPython]).concat(args), options);
}

VirtualEnv.prototype._reportProgress = function _reportProgress(action, target) {
  this._stdout.write(action + " " + target + "\n");
}

VirtualEnv.prototype._download = function _download(callback) {

  // Remove the previous copy of our virtualenv download.
  rimraf.sync(this._virtualenvTemp);

  // Start the download.
  var url = "https://pypi.python.org/packages/source/v/virtualenv/virtualenv-" + this._version + ".tar.gz";
  var downloadStream = request(url);

  // Stream the download through unzipping to the final destination.
  var gunzipStream = zlib.createGunzip();
  var untarStream = tar.Extract({path: this._virtualenvTemp});
  var finalStream = downloadStream.pipe(gunzipStream).pipe(untarStream);
  finalStream.on("end", callback);

  // Emit helpful events to track progress.
  this._reportProgress("downloading", url);
  downloadStream.on("end", function() {
    this._reportProgress("unzipping", url);
  }.bind(this));

}

VirtualEnv.prototype._create = function _create(callback) {

  // Remove the old virtualenv.
  this._reportProgress("removing", this._virtualenvHome);
  rimraf.sync(this._virtualenvHome);

  // Create new virtualenv in "node_modules/.virtualenv"
  this._reportProgress("creating", this._virtualenvHome);
  var createProc = spawn("python",
    ["virtualenv.py"].concat(this._createFlags).concat([this._virtualenvHome]),
    {cwd: this._virtualenvPath}
  );
  createProc.stderr.pipe(this._stderr);
  createProc.stdout.pipe(this._stdout);
  createProc.on("exit", function(code) {
    if (code) return callback(new Error("Error while creating virtualenv: exit " + code));
    callback();
  }.bind(this));

}

VirtualEnv.prototype._pip = function _pip(callback) {

  // Install Python dependencies into the virtualenv created in the create step.
  this._reportProgress("installing", this._virtualenvHome);
  var pipProc = spawn("bin/pip",
    ["install"].concat(this._pythonDeps),
    {cwd: this._virtualenvHome}
  );
  pipProc.stderr.pipe(this._stderr);
  pipProc.stdout.pipe(this._stdout);
  pipProc.on("exit", function(code) {
    if (code) return callback(new Error("Error while installing dependencies in virtualenv: exit " + code));
    callback();
  }.bind(this));

}

VirtualEnv.prototype._cleanup = function _cleanup(callback) {
  this._reportProgress("cleaning", this._virtualenvTemp);
  rimraf.sync(this._virtualenvTemp);
}

module.exports = function virtualenv(packagePath, options) {
  return new VirtualEnv(packagePath, options);
}
