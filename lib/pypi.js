// Vendored from https://github.com/lukaszb/pypi/commit/85d384a96ee2ee90c73c8e8f1235377b71465c39

// Copyright (c) 2011 Lukasz Balcerzak

// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation
// files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use,
// copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following
// conditions:

// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
// OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
// WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.

// Authors ordered by first contribution
// - Lukasz Balcerzak <lukaszbalcerzak@gmail.com>
// - Kenneth Falck <kennu@iki.fi>

var xmlrpc = require('xmlrpc');

var DEFAULT_URL = 'https://pypi.python.org/pypi';

function Client(url) {
  if (url == null) {
    url = DEFAULT_URL;
  }
  this.url = url;
  this.xmlrpcClient = xmlrpc.createSecureClient(this.url);
}

Client.prototype.callXmlrpc = function(method, args, callback, onError) {
  return this.xmlrpcClient.methodCall(method, args, function(error, value) {
    if (error && onError) {
      return onError(error);
    } else if (callback) {
      return callback(value);
    }
  });
};

Client.prototype.getPackageReleases = function(pkg, callback, onError, showHidden) {
  if (showHidden == null) {
    showHidden = false;
  }
  return this.callXmlrpc("package_releases", [pkg, showHidden], callback, onError);
};

Client.prototype.getPackagesList = function(callback, onError) {
  return this.callXmlrpc("list_packages", [], callback, onError);
};

Client.prototype.getPackageRoles = function(pkg, callback, onError) {
  return this.callXmlrpc("package_roles", [pkg], callback, onError);
};

Client.prototype.getUserPackages = function(pkg, callback, onError) {
  return this.callXmlrpc("user_packages", [pkg], callback, onError);
};

Client.prototype.getReleaseData = function(pkg, version, callback, onError) {
  return this.callXmlrpc("release_data", [pkg, version], callback, onError);
};

Client.prototype.getReleaseDownloads = function(pkg, version, callback, onError) {
  return this.callXmlrpc("release_downloads", [pkg, version], callback, onError);
};

Client.prototype.getReleaseUrls = function(pkg, version, callback, onError) {
  return this.callXmlrpc("release_urls", [pkg, version], callback, onError);
};

Client.prototype.search = function(pkg, callback, onError) {
  return this.callXmlrpc("search", [{name: pkg}], callback, onError);
};

exports.Client = Client;
