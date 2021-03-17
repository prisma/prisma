'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.default = _default;

function fs() {
  const data = _interopRequireWildcard(require('graceful-fs'));

  fs = function () {
    return data;
  };

  return data;
}

var _createProcessObject = _interopRequireDefault(
  require('./createProcessObject')
);

var _deepCyclicCopy = _interopRequireDefault(require('./deepCyclicCopy'));

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {default: obj};
}

function _getRequireWildcardCache() {
  if (typeof WeakMap !== 'function') return null;
  var cache = new WeakMap();
  _getRequireWildcardCache = function () {
    return cache;
  };
  return cache;
}

function _interopRequireWildcard(obj) {
  if (obj && obj.__esModule) {
    return obj;
  }
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) {
    return {default: obj};
  }
  var cache = _getRequireWildcardCache();
  if (cache && cache.has(obj)) {
    return cache.get(obj);
  }
  var newObj = {};
  var hasPropertyDescriptor =
    Object.defineProperty && Object.getOwnPropertyDescriptor;
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      var desc = hasPropertyDescriptor
        ? Object.getOwnPropertyDescriptor(obj, key)
        : null;
      if (desc && (desc.get || desc.set)) {
        Object.defineProperty(newObj, key, desc);
      } else {
        newObj[key] = obj[key];
      }
    }
  }
  newObj.default = obj;
  if (cache) {
    cache.set(obj, newObj);
  }
  return newObj;
}

/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
const DTRACE = Object.keys(global).filter(key => key.startsWith('DTRACE'));

function _default(globalObject, globals) {
globalObject.process = process
  const symbol = globalObject.Symbol; // Keep a reference to some globals that Jest needs

  Object.defineProperties(globalObject, {
    [symbol.for('jest-native-promise')]: {
      enumerable: false,
      value: Promise,
      writable: false
    },
    [symbol.for('jest-native-now')]: {
      enumerable: false,
      value: globalObject.Date.now.bind(globalObject.Date),
      writable: false
    },
    [symbol.for('jest-native-read-file')]: {
      enumerable: false,
      value: fs().readFileSync.bind(fs()),
      writable: false
    },
    [symbol.for('jest-native-write-file')]: {
      enumerable: false,
      value: fs().writeFileSync.bind(fs()),
      writable: false
    },
    [symbol.for('jest-native-exists-file')]: {
      enumerable: false,
      value: fs().existsSync.bind(fs()),
      writable: false
    },
    'jest-symbol-do-not-touch': {
      enumerable: false,
      value: symbol,
      writable: false
    }
  }); // Forward some APIs.

  DTRACE.forEach(dtrace => {
    // @ts-expect-error: no index
    globalObject[dtrace] = function (...args) {
      // @ts-expect-error: no index
      return global[dtrace].apply(this, args);
    };
  }); // Forward some others (this breaks the sandbox but for now it's OK).

  globalObject.Buffer = global.Buffer;
  globalObject.setImmediate = global.setImmediate;
  globalObject.clearImmediate = global.clearImmediate;
  return Object.assign(globalObject, (0, _deepCyclicCopy.default)(globals));
}
