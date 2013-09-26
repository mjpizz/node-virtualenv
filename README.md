## node-virtualenv

node-virtualenv allows you to include Python dependencies in your node projects,
without cluttering up your system environment.

For example, let's add Skype4Py as a dependency to our project. In your
**package.json**, we are going to add 3 things:

1. Dependency on `virtualenv` (this library)
2. Section for "virtualenv", including the version of virtualenv we want.
3. [Postinstall](https://npmjs.org/doc/scripts.html) to prepare the virtualenv
   every time your module is npm installed.

```json
{
  "dependencies": {
    "virtualenv": "*"
  },
  "virtualenv": {
    "version": "1.10.1",
    "dependencies": [
      "Skype4Py==1.0.35"
    ]
  },
  "scripts": {
    "postinstall": "virtualenv-postinstall"
  },
}
```

When you run `npm install`, the Skype4Py dependency will be isolated
in a virtualenv located under **./node_modules/.virtualenv**.

Next, spawn your isolated Python virtualenv from node:

```javascript
var virtualenv = require("virtualenv");
var packagePath = require.resolve("./package.json")
var env = virtualenv(packagePath);

// This is a child_process running Python using your virtualenv. You can
// communicate with it over stdin/stdout, etc.
var child = env.spawnPython(["./my_python_helper.py"]);
```

You can also `spawn` any of the other commands in the virtualenv. For example,
if you added a Python tool like [fabric](http://docs.fabfile.org/en/1.8/) as
a dependency, you can access the command `fab` that it installs:

```javascript
var virtualenv = require("virtualenv");
var packagePath = require.resolve("./package.json")
var env = virtualenv(packagePath);

// This is a child_process running fabric using your virtualenv.
var child = env.spawn("fab", ["deploy", "-H", "example1.net,example2.net"]);
```

## Contributing

Just make a pull request :)
