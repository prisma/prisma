// from https://github.com/visionmedia/debug/blob/master/src/node.js
/**
 * Module dependencies.
 */

import tty from 'tty'
import util from 'util'

/**
 * This is the Node.js implementation of `debug()`.
 */

exports.init = init
exports.log = log
exports.formatArgs = formatArgs
exports.save = save
exports.load = load
exports.useColors = useColors
exports.destroy = util.deprecate(() => {},
'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.')

/**
 * Colors.
 */

exports.colors = [6, 2, 3, 4, 5, 1]

/**
 * Build up the default `inspectOpts` object from the environment variables.
 *
 *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
 */

exports.inspectOpts = Object.keys(process.env)
  .filter((key) => {
    return /^debug_/i.test(key)
  })
  .reduce((obj, key) => {
    // Camel-case
    const prop = key
      .substring(6)
      .toLowerCase()
      .replace(/_([a-z])/g, (_, k) => {
        return k.toUpperCase()
      })

    // Coerce string value into JS value
    let val: any = process.env[key]!
    if (/^(yes|on|true|enabled)$/i.test(val)) {
      val = true
    } else if (/^(no|off|false|disabled)$/i.test(val)) {
      val = false
    } else if (val === 'null') {
      val = null
    } else {
      val = Number(val)
    }

    obj[prop] = val
    return obj
  }, {})

/**
 * Is stdout a TTY? Colored output is enabled when `true`.
 */

function useColors() {
  return 'colors' in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty((process.stderr as any)?.fd)
}

/**
 * Adds ANSI color escape codes if enabled.
 *
 * @api public
 */

function formatArgs(this, args) {
  const { namespace: name, useColors } = this

  if (useColors) {
    const c = this.color
    const colorCode = '\u001B[3' + (c < 8 ? c : '8;5;' + c)
    const prefix = `  ${colorCode};1m${name} \u001B[0m`

    args[0] = prefix + args[0].split('\n').join('\n' + prefix)
    args.push(colorCode + 'm+' + module.exports.humanize(this.diff) + '\u001B[0m')
  } else {
    args[0] = getDate() + name + ' ' + args[0]
  }
}

function getDate() {
  if (exports.inspectOpts.hideDate) {
    return ''
  }
  return new Date().toISOString() + ' '
}

/**
 * Invokes `util.format()` with the specified arguments and writes to stderr.
 */

function log(...args) {
  return process.stderr.write(util.format(...args) + '\n')
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */
function save(namespaces) {
  if (namespaces) {
    process.env.DEBUG = namespaces
  } else {
    // If you set a process.env field to null or undefined, it gets cast to the
    // string 'null' or 'undefined'. Just delete instead.
    delete process.env.DEBUG
  }
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  return process.env.DEBUG
}

/**
 * Init logic for `debug` instances.
 *
 * Create a new `inspectOpts` object in case `useColors` is set
 * differently for a particular `debug` instance.
 */

function init(debug) {
  debug.inspectOpts = {}

  const keys = Object.keys(exports.inspectOpts)
  for (let i = 0; i < keys.length; i++) {
    debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]]
  }
}

import { setup } from './common'
const mod = setup(exports)
module.exports = mod
export default mod

const { formatters } = mod

/**
 * Map %o to `util.inspect()`, all on a single line.
 */

formatters.o = function (v) {
  this.inspectOpts.colors = this.useColors
  return util
    .inspect(v, this.inspectOpts)
    .split('\n')
    .map((str) => str.trim())
    .join(' ')
}

/**
 * Map %O to `util.inspect()`, allowing multiple lines if needed.
 */

formatters.O = function (v) {
  this.inspectOpts.colors = this.useColors
  return util.inspect(v, this.inspectOpts)
}
