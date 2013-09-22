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
  this._virtualenvRoot = path.join(this._virtualenvHome, "virtualenv-" + this._version);
  this._virtualenvPath = path.join(this._virtualenvRoot, "node-virtualenv");

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
        callback();
      }.bind(this));
    }.bind(this));
  }.bind(this));
}

VirtualEnv.prototype.spawnPython = function spawnPython(args, options) {
  var pathToPython = path.join(this._virtualenvPath, "bin", "python");
  return spawn(pathToPython, args, options);
}

VirtualEnv.prototype.spawn32bitOSXPython = function spawn32bitOSXPython(args, options) {
  var pathToPython = path.join(this._virtualenvPath, "bin", "python");
  return spawn("arch", ["-i386"].concat([pathToPython]).concat(args), options);
}

VirtualEnv.prototype._reportProgress = function _reportProgress(action, target) {
  this._stdout.write(action + " " + target + "\n");
}

VirtualEnv.prototype._download = function _download(callback) {

  // Remove the previous copy of our virtualenv.
  rimraf.sync(this._virtualenvHome);

  // Start the download.
  var url = "https://pypi.python.org/packages/source/v/virtualenv/virtualenv-" + this._version + ".tar.gz";
  var downloadStream = request(url);

  // Stream the download through unzipping to the final destination.
  var gunzipStream = zlib.createGunzip();
  var untarStream = tar.Extract({path: this._virtualenvHome});
  var finalStream = downloadStream.pipe(gunzipStream).pipe(untarStream);
  finalStream.on("end", callback);

  // Emit helpful events to track progress.
  this._reportProgress("downloading", url);
  downloadStream.on("end", function() {
    this._reportProgress("unzipping", url);
  }.bind(this));

}

VirtualEnv.prototype._create = function _create(callback) {

  // Create virtualenv in "node_modules/.virtualenv/virtualenv-X/node-virtualenv"
  this._reportProgress("creating", this._virtualenvPath);
  var virtualenvName = path.basename(this._virtualenvPath);
  var createProc = spawn("python",
    ["virtualenv.py"].concat(this._createFlags).concat([virtualenvName]),
    {cwd: this._virtualenvRoot}
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
  this._reportProgress("installing", this._virtualenvPath);
  var pipProc = spawn("bin/pip",
    ["install"].concat(this._pythonDeps),
    {cwd: this._virtualenvPath}
  );
  pipProc.stderr.pipe(this._stderr);
  pipProc.stdout.pipe(this._stdout);
  pipProc.on("exit", function(code) {
    if (code) return callback(new Error("Error while installing dependencies in virtualenv: exit " + code));
    callback();
  }.bind(this));

}

module.exports = function virtualenv(packagePath, options) {
  return new VirtualEnv(packagePath, options);
}
