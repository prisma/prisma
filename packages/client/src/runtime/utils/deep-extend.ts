// Taken from https://github.com/unclechu/node-deep-extend/blob/master/lib/deep-extend.js
// es2017-ified, now it's about 2.5 times faster
/*!
 * @description Recursive object extending
 * @author Viacheslav Lotsmanov <lotsmanov89@gmail.com>
 * @license MIT
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2013-2018 Viacheslav Lotsmanov
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

function isSpecificValue(val) {
  return val instanceof Buffer || val instanceof Date || val instanceof RegExp ? true : false
}

function cloneSpecificValue(val) {
  if (val instanceof Buffer) {
    const x = Buffer.alloc ? Buffer.alloc(val.length) : new Buffer(val.length)
    val.copy(x)
    return x
  } else if (val instanceof Date) {
    return new Date(val.getTime())
  } else if (val instanceof RegExp) {
    return new RegExp(val)
  } else {
    throw new Error('Unexpected situation')
  }
}

/**
 * Recursive cloning array.
 */
function deepCloneArray(arr) {
  const clone: any = []
  arr.forEach(function (item, index) {
    if (typeof item === 'object' && item !== null) {
      if (Array.isArray(item)) {
        clone[index] = deepCloneArray(item)
      } else if (isSpecificValue(item)) {
        clone[index] = cloneSpecificValue(item)
      } else {
        clone[index] = deepExtend({}, item)
      }
    } else {
      clone[index] = item
    }
  })
  return clone
}

function safeGetProperty(object, property) {
  return property === '__proto__' ? undefined : object[property]
}

/**
 * Extending object that entered in first argument.
 *
 * Returns extended object or false if have no target object or incorrect type.
 *
 * If you wish to clone source object (without modify it), just use empty new
 * object as first argument, like this:
 *   deepExtend({}, yourObj_1, [yourObj_N]);
 */
export const deepExtend = function (target, ...args) {
  if (!target || typeof target !== 'object') {
    return false
  }

  if (args.length === 0) {
    return target
  }

  let val, src

  for (const obj of args) {
    // skip argument if isn't an object, is null, or is an array
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      continue
    }

    for (const key of Object.keys(obj)) {
      src = safeGetProperty(target, key) // source value
      val = safeGetProperty(obj, key) // new value

      // recursion prevention
      if (val === target) {
        continue

        /**
         * if new value isn't object then just overwrite by new value
         * instead of extending.
         */
      } else if (typeof val !== 'object' || val === null) {
        target[key] = val
        continue

        // just clone arrays (and recursive clone objects inside)
      } else if (Array.isArray(val)) {
        target[key] = deepCloneArray(val)
        continue

        // custom cloning and overwrite for specific objects
      } else if (isSpecificValue(val)) {
        target[key] = cloneSpecificValue(val)
        continue

        // overwrite by new value if source isn't object or array
      } else if (typeof src !== 'object' || src === null || Array.isArray(src)) {
        target[key] = deepExtend({}, val)
        continue

        // source value and new value is objects both, extending...
      } else {
        target[key] = deepExtend(src, val)
        continue
      }
    }
  }

  return target
}
