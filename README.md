## node-virtualenv

node-virtualenv enables Python dependencies in your node projects,
without cluttering up the system environment.

For example, let's add Skype4Py as a dependency to a project. In the
**package.json**, add 2 things:

1. Dependency on `virtualenv` (this library)
2. [Postinstall](https://npmjs.org/doc/scripts.html) to prepare the virtualenv
   every time your module is npm installed.

```json
{
  "dependencies": {
    "virtualenv": "*"
  },
  "scripts": {
    "postinstall": "virtualenv-postinstall"
  }
}
```

Next, make a [requirements.txt](http://www.pip-installer.org/en/latest/cookbook.html#requirements-files)
in the same directory as package.json, containing this line:

```
Skype4Py==1.0.35
```

When you run `npm install`, the Skype4Py dependency will be isolated
in a virtualenv located under **.node-virtualenv**.

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

## Advanced usage

You can modify the way the virtualenv is created during postinstall.
For example, if your node module still functions without the Python extras,
you can make virtualenv optional (in case the user doesn't have Python). Do
this by adding a "virtualenv" key to your package.json:

```javascript
  "virtualenv": {
    "optional": true
  }
```

Depend on a specific version of virtualenv:

```javascript
  "virtualenv": {
    "version": "15.0.x"
  }
```

Send flags to the virtualenv creation command:

```javascript
  "virtualenv": {
    "flags": [
      "--system-site-packages"
    ]
  }
```

Launch virtualenv.py using a specific python interpreter

```javascript
  "virtualenv": {
    "python": "/path/to/my/python"
  }
```


## References

* Official [virtualenv documentation](http://www.virtualenv.org/en/latest/)
* Official [pip documentation](http://www.pip-installer.org/en/latest/index.html)
* Heroku [pip article](https://devcenter.heroku.com/articles/python-pip)

## Contributing

Just make a pull request :)
