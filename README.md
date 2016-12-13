# ovo

[![CircleCI](https://circleci.com/gh/psastras/ovo.svg?style=shield&circle-token=:circle-ci-badge-token)](https://circleci.com/gh/psastras/ovo/tree/master)
[![codecov](https://codecov.io/gh/psastras/ovo/branch/master/graph/badge.svg)](https://codecov.io/gh/psastras/ovo)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

An alternate [Zipkin](http://zipkin.io/) UI

![Screenshot](/screenshot.png "Screenshot")

## Running

### npm

The web server is available via the npm repository.

```
npm i -g @psastras/ovo
ovo
```

Note that this starts expects Zipkin to be running on `http://localhost:9411` and the UI server
on port 8080.

`ovo` accepts a custom port number via `-p` and a custom Zipkin host via `-h` (use the `--help`)
argument for a list of supported options.


### Node

To launch the server which will serve files out of `dist/`

```
node index.js
```

Note that this expects Zipkin to be running on `http://localhost:9411`.

### Docker

To quickly launch a demo the provided Docker compose file will launch both Zipkin and the UI.

```
docker-compose build
docker-compose up
```

## Development

The preferred way to install dependencies is [Yarn](https://github.com/yarnpkg/yarn).  This repo
includes a `yarn.lock` file to ensure dependencies are consistent on install.

```
npm i -g yarn
yarn install
```

For most development purposes running the `watch` command should be enough

```
yarn watch
```

The `watch` commands starts a webpack development server at
[http://127.0.0.1:8080](http://127.0.0.1:8080).  It also watches test files in the `test/` test
directory for changes and runs the changed tests as necessary.  When making changes to the source
code in `src/`, relavant tests will be run as well.

To manually run tests and generate a code coverage report (and lint the code),

```
yarn test
```

To build a production distribution (minified, etc.)

```
yarn build
```

The production build files will be located in `dist/`.

This project uses Selenium for integration tests.  Integration tests can be run using

```
yarn integrationtest
```