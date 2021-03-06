/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.

import * as path from 'path';
import * as glob from 'glob';
import * as webpack from 'webpack';
const webpackDevMiddleware = require('webpack-dev-middleware');

import { KarmaWebpackFailureCb } from './karma-webpack-failure-cb';
import { statsErrorsToString } from '../utils/stats';
import { getWebpackStatsConfig } from '../configs/stats';
import { createConsoleLogger } from '@angular-devkit/core/node';
import { logging } from '@angular-devkit/core';
import { WebpackTestOptions } from '../../utils/build-options';
import { normalizeSourceMaps } from '../../utils/index';

/**
 * Enumerate needed (but not require/imported) dependencies from this file
 *  to let the dependency validator know they are used.
 *
 * require('source-map-support')
 * require('karma-source-map-support')
 */


let blocked: any[] = [];
let isBlocked = false;
let webpackMiddleware: any;
let successCb: () => void;
let failureCb: () => void;

// Add files to the Karma files array.
function addKarmaFiles(files: any[], newFiles: any[], prepend = false) {
  const defaults = {
    included: true,
    served: true,
    watched: true
  };

  const processedFiles = newFiles
    // Remove globs that do not match any files, otherwise Karma will show a warning for these.
    .filter(file => glob.sync(file.pattern, { nodir: true }).length != 0)
    // Fill in pattern properties with defaults.
    .map(file => ({ ...defaults, ...file }));

  // It's important to not replace the array, because
  // karma already has a reference to the existing array.
  if (prepend) {
    files.unshift(...processedFiles);
  } else {
    files.push(...processedFiles);
  }
}

const init: any = (config: any, emitter: any, customFileHandlers: any) => {
  if (!config.buildWebpack) {
    throw new Error(`The '@angular-devkit/build-angular/plugins/karma' karma plugin is meant to` +
    ` be used from within Angular CLI and will not work correctly outside of it.`
    )
  }
  const options = config.buildWebpack.options as WebpackTestOptions;
  const logger: logging.Logger = config.buildWebpack.logger || createConsoleLogger();
  successCb = config.buildWebpack.successCb;
  failureCb = config.buildWebpack.failureCb;

  // Add a reporter that fixes sourcemap urls.
  if (normalizeSourceMaps(options.sourceMap).scripts) {
    config.reporters.unshift('@angular-devkit/build-angular--sourcemap-reporter');

    // Code taken from https://github.com/tschaub/karma-source-map-support.
    // We can't use it directly because we need to add it conditionally in this file, and karma
    // frameworks cannot be added dynamically.
    const smsPath = path.dirname(require.resolve('source-map-support'));
    const ksmsPath = path.dirname(require.resolve('karma-source-map-support'));

    addKarmaFiles(config.files, [
      { pattern: path.join(smsPath, 'browser-source-map-support.js'), watched: false },
      { pattern: path.join(ksmsPath, 'client.js'), watched: false }
    ], true);
  }

  config.reporters.unshift('@angular-devkit/build-angular--event-reporter');

  // When using code-coverage, auto-add karma-coverage.
  if (options.codeCoverage) {
    config.plugins = config.plugins || [];
    config.reporters = config.reporters || [];
    const {plugins, reporters} = config;
    const hasCoveragePlugin = plugins.some((p: {}) => 'reporter:coverage' in p);
    const hasIstanbulPlugin = plugins.some((p: {}) => 'reporter:coverage-istanbul' in p);
    const hasCoverageReporter = reporters.includes('coverage');
    const hasIstanbulReporter = reporters.includes('coverage-istanbul');
    if (hasCoveragePlugin && !hasCoverageReporter) {
      reporters.push('coverage');
      logger.warn(`There is a known issue with Karma and karma-coverage. Tests that exceed the coverage threshold will not fail. This will be fixed in Karma 5.2.x soon.`)
    }
    else if (hasIstanbulPlugin && !hasIstanbulReporter) {
      // coverage-istanbul is deprecated in favor of karma-coverage
      reporters.push('coverage-istanbul');
    } else if (!hasCoveragePlugin && !hasIstanbulPlugin) {
      throw new Error('karma-coverage must be installed in order to run code coverage.');
    }

    if (hasIstanbulPlugin) {
      logger.warn(`'karma-coverage-istanbul-reporter' usage has been deprecated since version 11.\n` +
       `Please install 'karma-coverage' and update 'karma.conf.js.' ` +
       'For more info, see https://github.com/karma-runner/karma-coverage/blob/master/README.md');
    }
  }

  // Add webpack config.
  const webpackConfig = config.buildWebpack.webpackConfig;
  const webpackMiddlewareConfig = {
    // Hide webpack output because its noisy.
    logLevel: 'error',
    stats: false,
    publicPath: '/_karma_webpack_/',
  };

  const compilationErrorCb = (error: string | undefined, errors: string[]) => {
    // Notify potential listeners of the compile error
    emitter.emit('compile_error', errors);

    // Finish Karma run early in case of compilation error.
    emitter.emit('run_complete', [], { exitCode: 1 });

    // Unblock any karma requests (potentially started using `karma run`)
    unblock();
  }
  webpackConfig.plugins.push(new KarmaWebpackFailureCb(compilationErrorCb));

  // Use existing config if any.
  config.webpack = Object.assign(webpackConfig, config.webpack);
  config.webpackMiddleware = Object.assign(webpackMiddlewareConfig, config.webpackMiddleware);

  // Our custom context and debug files list the webpack bundles directly instead of using
  // the karma files array.
  config.customContextFile = `${__dirname}/karma-context.html`;
  config.customDebugFile = `${__dirname}/karma-debug.html`;

  // Add the request blocker and the webpack server fallback.
  config.beforeMiddleware = config.beforeMiddleware || [];
  config.beforeMiddleware.push('@angular-devkit/build-angular--blocker');
  config.middleware = config.middleware || [];
  config.middleware.push('@angular-devkit/build-angular--fallback');

  // The webpack tier owns the watch behavior so we want to force it in the config.
  webpackConfig.watch = !config.singleRun;
  if (config.singleRun) {
    // There's no option to turn off file watching in webpack-dev-server, but
    // we can override the file watcher instead.
    webpackConfig.plugins.unshift({
      apply: (compiler: any) => { // tslint:disable-line:no-any
        compiler.hooks.afterEnvironment.tap('karma', () => {
          compiler.watchFileSystem = { watch: () => { } };
        });
      },
    });
  }
  // Files need to be served from a custom path for Karma.
  webpackConfig.output.path = '/_karma_webpack_/';
  webpackConfig.output.publicPath = '/_karma_webpack_/';

  let compiler: any;
  try {
    compiler = webpack(webpackConfig);
  } catch (e) {
    logger.error(e.stack || e)
    if (e.details) {
      logger.error(e.details)
    }
    throw e;
  }

  function handler(callback?: () => void) {
    isBlocked = true;

    if (typeof callback === 'function') {
      callback();
    }
  }

  compiler.hooks.invalid.tap('karma', () => handler());

  compiler.hooks.watchRun.tapAsync('karma', (_: any, callback: () => void) => handler(callback));

  compiler.hooks.run.tapAsync('karma', (_: any, callback: () => void) => handler(callback));

  function unblock(){
    isBlocked = false;
    blocked.forEach((cb) => cb());
    blocked = [];
  }

  let lastCompilationHash: string | undefined;
  const statsConfig = getWebpackStatsConfig();
  compiler.hooks.done.tap('karma', (stats: any) => {
    if (stats.compilation.errors.length > 0) {
      const json = stats.toJson(config.stats);
      // Print compilation errors.
      logger.error(statsErrorsToString(json, statsConfig));
      lastCompilationHash = undefined;
      // Emit a failure build event if there are compilation errors.
      failureCb();
    } else if (stats.hash != lastCompilationHash) {
      // Refresh karma only when there are no webpack errors, and if the compilation changed.
      lastCompilationHash = stats.hash;
      emitter.refreshFiles();
    }
    unblock();
  });

  webpackMiddleware = new webpackDevMiddleware(compiler, webpackMiddlewareConfig);

  // Forward requests to webpack server.
  customFileHandlers.push({
    urlRegex: /^\/_karma_webpack_\/.*/,
    handler: function handler(req: any, res: any) {
      webpackMiddleware(req, res, function () {
        // Ensure script and style bundles are served.
        // They are mentioned in the custom karma context page and we don't want them to 404.
        const alwaysServe = [
          '/_karma_webpack_/runtime.js',
          '/_karma_webpack_/polyfills.js',
          '/_karma_webpack_/polyfills-es5.js',
          '/_karma_webpack_/scripts.js',
          '/_karma_webpack_/styles.js',
          '/_karma_webpack_/vendor.js',
        ];
        if (alwaysServe.indexOf(req.url) != -1) {
          res.statusCode = 200;
          res.end();
        } else {
          res.statusCode = 404;
          res.end('Not found');
        }
      });
    }
  });

  emitter.on('exit', (done: any) => {
    webpackMiddleware.close();
    done();
  });
};

init.$inject = ['config', 'emitter', 'customFileHandlers'];

// Block requests until the Webpack compilation is done.
function requestBlocker() {
  return function (_request: any, _response: any, next: () => void) {
    if (isBlocked) {
      blocked.push(next);
    } else {
      next();
    }
  };
}

// Copied from "karma-jasmine-diff-reporter" source code:
// In case, when multiple reporters are used in conjunction
// with initSourcemapReporter, they both will show repetitive log
// messages when displaying everything that supposed to write to terminal.
// So just suppress any logs from initSourcemapReporter by doing nothing on
// browser log, because it is an utility reporter,
// unless it's alone in the "reporters" option and base reporter is used.
function muteDuplicateReporterLogging(context: any, config: any) {
  context.writeCommonMsg = function () { };
  const reporterName = '@angular/cli';
  const hasTrailingReporters = config.reporters.slice(-1).pop() !== reporterName;

  if (hasTrailingReporters) {
    context.writeCommonMsg = function () { };
  }
}

// Emits builder events.
const eventReporter: any = function (this: any, baseReporterDecorator: any, config: any) {
  baseReporterDecorator(this);

  muteDuplicateReporterLogging(this, config);

  this.onRunComplete = function (_browsers: any, results: any) {
    if (results.exitCode === 0) {
      successCb();
    } else {
      failureCb();
    }
  }

  // avoid duplicate failure message
  this.specFailure = () => {};
};

eventReporter.$inject = ['baseReporterDecorator', 'config'];

// Strip the server address and webpack scheme (webpack://) from error log.
const sourceMapReporter: any = function (this: any, baseReporterDecorator: any, config: any) {
  baseReporterDecorator(this);
  muteDuplicateReporterLogging(this, config);

  const urlRegexp = /http:\/\/localhost:\d+\/_karma_webpack_\/(webpack:\/)?/gi;

  this.onSpecComplete = function (_browser: any, result: any) {
    if (!result.success) {
      result.log = result.log.map((l: string) => l.replace(urlRegexp, ''));
    }
  };

  // avoid duplicate complete message
  this.onRunComplete = () => {};

  // avoid duplicate failure message
  this.specFailure = () => {};
};

sourceMapReporter.$inject = ['baseReporterDecorator', 'config'];

// When a request is not found in the karma server, try looking for it from the webpack server root.
function fallbackMiddleware() {
  return function (req: any, res: any, next: () => void) {
    if (webpackMiddleware) {
      const webpackUrl = '/_karma_webpack_' + req.url;
      const webpackReq = { ...req, url: webpackUrl }
      webpackMiddleware(webpackReq, res, next);
    } else {
      next();
    }
  };
}

module.exports = {
  'framework:@angular-devkit/build-angular': ['factory', init],
  'reporter:@angular-devkit/build-angular--sourcemap-reporter': ['type', sourceMapReporter],
  'reporter:@angular-devkit/build-angular--event-reporter': ['type', eventReporter],
  'middleware:@angular-devkit/build-angular--blocker': ['factory', requestBlocker],
  'middleware:@angular-devkit/build-angular--fallback': ['factory', fallbackMiddleware]
};
