var fs = require("fs");
var path = require("path");
var childProcess = require("child_process");
var crypto = require("crypto");
var tar = require("tar");
var zlib = require("zlib");
var rimraf = require("rimraf");
var request = require("request");
var semver = require("semver");

// The pypi npm package currently is coffeescript, so bootstrap
// coffee extensions before trying to load pypi.
// TODO: submit a patch to https://github.com/lukaszb/pypi
require("coffee-script");
var pypi = require("pypi");

var VERSION = require("../package.json").version;

function VirtualEnv(packagePath, options) {
  options = options || {};

  // Details come directly from the given package.json
  // TODO: autodetect packagePath (when null) based on previous stack frame
  var package = require(packagePath);
  this._version = package.virtualenv.version || "*";
  this._createFlags = package.virtualenv.flags || [];

  // Read requirements from requirements.txt if it exists.
  this._requirements = path.join(path.dirname(packagePath), "requirements.txt");
  if (!fs.existsSync(this._requirements)) {
    throw new Error("missing requirements.txt in " + path.dirname(packagePath));
  }

  // Figure out our paths.
  this._virtualenvHome = path.join(path.dirname(packagePath), "node_modules", ".virtualenv");
  this._virtualenvMetaHome = path.join(this._virtualenvHome, ".node-virtualenv-meta.json");
  this._virtualenvTemp = path.join(path.dirname(packagePath), "node_modules", ".virtualenv-temp");

  // Hash the current virtualenv state to determine if a reinstall is actually
  // Reinstallation should happen only when one of the following changes:
  // 1. Version changes in node-virtualenv (VERSION)
  // 2. Dependencies change in the "virtualenv" section (package.virtualenv)
  // 3. Postinstall script changes (package.scripts.postinstall)
  // Therefore the hash contains all three of these factors.
  // TODO: intelligently pip install -U when only the pip dependencies changed
  this._expectedHash = this._createVirtualenvHash(package);
  this._currentHash = this._getMeta("virtualenvHash", null);

  // Allow installation progress to be logged on alternative
  // streams, but default to to stdout and stderr.
  this._stdout = options.stdout || process.stdout;
  this._stderr = options.stderr || process.stderr;

}

VirtualEnv.prototype.install = function install(options, callback) {
  if (!callback) {
    callback = options;
    options = {};
  }

  // Skip install if it isn't necessary.
  if (this._expectedHash === this._currentHash) {
    this._reportProgress("Ready", this._virtualenvHome);
    return callback();
  }

  this._find(function(err, version, url) {
    if (err) return callback(err);
    this._download(url, function(err) {
      if (err) return callback(err);
      this._create(version, function(err) {
        if (err) return callback(err);
        this._pip(function(err) {
          if (err) return callback(err);
          this._cleanup(function(err) {
            if (err) return callback(err);

            // Write the current hash from the package since this installation
            // was successful.
            this._setMeta("virtualenvHash", this._expectedHash);
            this._setMeta("tarballUrl", url);
            callback();

          }.bind(this));
        }.bind(this));
      }.bind(this));
    }.bind(this));
  }.bind(this));

}

VirtualEnv.prototype.spawn = function spawn(command, args, options) {
  var pathToVirtualenvCommand = path.join(this._virtualenvHome, "bin", command);
  return childProcess.spawn(pathToVirtualenvCommand, args, options);
}

VirtualEnv.prototype.spawnPython = function spawnPython(args, options) {
  var pathToPython = path.join(this._virtualenvHome, "bin", "python");
  return childProcess.spawn(pathToPython, args, options);
}

VirtualEnv.prototype.spawn32bitOSXPython = function spawn32bitOSXPython(args, options) {
  var pathToPython = path.join(this._virtualenvHome, "bin", "python");
  return childProcess.spawn("arch", ["-i386"].concat([pathToPython]).concat(args), options);
}

VirtualEnv.prototype._reportProgress = function _reportProgress(action, target) {
  this._stdout.write(action + " " + target + "\n");
}

VirtualEnv.prototype._find = function _find(callback) {

  // Find the available versions of virtualenv.
  var targetVersion = this._version;
  var client = new pypi.Client();
  this._reportProgress("Finding", "virtualenv " + targetVersion);

  client.getPackageReleases("virtualenv", function(versions) {
    if (!versions || !versions.length) return callback(new Error("virtualenv not found on pypi"));

    // Find the latest valid version.
    var latestValidVersion;
    versions.sort(function(a, b) {
      return semver.lt(a, b);
    }).some(function(version) {
      if (semver.satisfies(version, targetVersion)) {
        latestValidVersion = version;
        return true;
      }
    });
    if (!latestValidVersion) return callback(new Error("virtualenv " + version + " not found"));

    // Figure out the tarball URL for this version.
    client.getReleaseUrls("virtualenv", latestValidVersion, function(urls) {
      if (!urls || !urls.length) return callback(new Error("unable to find URL for virtualenv " + latestValidVersion));
      var tarballUrl;
      urls.some(function(url) {
        if (/\.tar\.gz$/.test(url.url)) {
          tarballUrl = url.url;
          return true;
        }
      });
      if (!tarballUrl) return callback(new Error("unable to find a tarball for virtualenv " + latestValidVersion));
      callback(null, latestValidVersion, tarballUrl);

    // Propagate pypi error callback.
    }, function(err) {
      callback(new Error("unable to retrieve release URLs for virtualenv " + latestValidVersion));
    });

  // Propagate pypi error callback.
  }, function(err) {
    callback(new Error("unable to retrieve version information for virtualenv"));
  });

}

VirtualEnv.prototype._download = function _download(url, callback) {

  // Remove the previous copy of our virtualenv download.
  rimraf.sync(this._virtualenvTemp);

  // Stream the download through unzipping to the final destination.
  var downloadStream = request(url);
  var gunzipStream = zlib.createGunzip();
  var untarStream = tar.Extract({path: this._virtualenvTemp});
  var finalStream = downloadStream.pipe(gunzipStream).pipe(untarStream);

  // Call the callback with either error or success when this is finished.
  finalStream.on("error", function(err) {
    if (callback) callback(err);
    callback = null;
  });
  finalStream.on("end", function() {
    if (callback) callback();
    callback = null;
  });

  // Emit helpful events to track progress.
  this._reportProgress("Downloading", url);
  downloadStream.on("end", function() {
    this._reportProgress("Unzipping", url);
  }.bind(this));

}

VirtualEnv.prototype._create = function _create(version, callback) {

  // Remove the old virtualenv.
  this._reportProgress("Removing", this._virtualenvHome);
  try {
    rimraf.sync(this._virtualenvHome);
  } catch(err) {
    return callback(err);
  }

  // Create new virtualenv in "node_modules/.virtualenv"
  this._reportProgress("Creating", this._virtualenvHome);
  virtualenvPath = path.join(this._virtualenvTemp, "virtualenv-" + version);
  var createProc = childProcess.spawn("python",
    ["virtualenv.py"].concat(this._createFlags).concat([this._virtualenvHome]),
    {cwd: virtualenvPath}
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
  this._reportProgress("Installing", this._virtualenvHome);
  var pipProc = childProcess.spawn("bin/pip",
    ["install", "-r", this._requirements],
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

  // Remove our temporary download folder.
  this._reportProgress("Cleaning", this._virtualenvTemp);
  rimraf(this._virtualenvTemp, callback);

}

VirtualEnv.prototype._createVirtualenvHash = function _createVirtualenvHash(package) {

  var md5 = crypto.createHash("md5");
  md5.update([
    VERSION,
    JSON.stringify(package.virtualenv),
    JSON.stringify(package.scripts ? package.scripts.postinstall : "")
    ].join(""));
  return md5.digest("hex");

}

VirtualEnv.prototype._getMeta = function _getMeta(key, defaultValue) {

  try {
    return require(this._virtualenvMetaHome)[key];
  } catch(err) {
    return defaultValue;
  }

}

VirtualEnv.prototype._setMeta = function _setMeta(key, value) {

  var meta = {};
  try {
    meta = require(this._virtualenvMetaHome);
  } catch(err) {
    meta = {};
  }

  meta[key] = value;
  fs.writeFileSync(this._virtualenvMetaHome, meta);

}

module.exports = function virtualenv(packagePath, options) {
  return new VirtualEnv(packagePath, options);
}
