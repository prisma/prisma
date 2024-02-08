/* eslint-disable no-var */
import * as kleur from 'kleur/colors'
import { bold } from 'kleur/colors'

const MAX_ARGS_HISTORY = 100
const COLORS = ['green', 'yellow', 'blue', 'magenta', 'cyan', 'red']

const argsHistory: [nsp: string, ...unknown[]][] = []
let lastTimestamp = Date.now()
let lastColor = 0

declare global {
  var DEBUG: string
  var DEBUG_COLORS: boolean
}

globalThis.DEBUG ??= process.env.DEBUG ?? ''
globalThis.DEBUG_COLORS ??=
  process.env.DEBUG_COLORS !== undefined ? process.env.DEBUG_COLORS === 'true' : undefined ?? true

/**
 * Top-level utilities to configure the debug module.
 *
 * @example
 * ```ts
 * import Debug from '@prisma/debug'
 * Debug.enable('prisma:client')
 * const debug = Debug('prisma:client')
 * debug('Hello World')
 * ```
 */
const topProps = {
  enable(namespace: any) {
    if (typeof namespace === 'string') {
      DEBUG = namespace
    }
  },
  disable() {
    const prev = DEBUG
    DEBUG = ''
    return prev
  },
  enabled(namespace: string) {
    return DEBUG.split(',').every((ns) => {
      const isNegated = ns.startsWith('-')
      ns = isNegated ? ns.slice(1) : ns

      let listenedParts = ns.split(':')
      let emittedParts = namespace.split(':')
      const sizeDiff = listenedParts.length - emittedParts.length

      // here we make that the two compared arrays have the same length
      if (listenedParts.length > emittedParts.length) {
        emittedParts = [...emittedParts, ...Array(Math.abs(sizeDiff)).fill(undefined)]
      } else if (listenedParts.length < emittedParts.length) {
        // if the last part is a wildcard, we fill the rest with wildcards
        const filler = listenedParts[listenedParts.length - 1] === '*' ? '*' : undefined
        listenedParts = [...listenedParts, ...Array(Math.abs(sizeDiff)).fill(filler)]
      }

      const matched = listenedParts.every((listenedPart, i) => {
        return listenedPart === emittedParts[i] || (emittedParts[i] !== undefined && listenedPart === '*')
      })

      return isNegated ? !matched : matched
    })
  },
  log(this: void, ...args: string[]) {
    const [ns, format, ...rest] = args
    // console can only format the very first argument
    // because of that, we concat both `ns` & `format`
    console.log(`${ns} ${format}`, ...rest)
  },
  formatters: {}, // not implemented
}

/**
 * Create a new debug instance with the given namespace.
 *
 * @example
 * ```ts
 * import Debug from '@prisma/debug'
 * const debug = Debug('prisma:client')
 * debug('Hello World')
 * ```
 */
function debugCreate(namespace: string) {
  let forceEnabled: boolean | undefined
  const instanceProps = {
    color: COLORS[lastColor++ % COLORS.length],
    namespace: namespace,
    log: topProps.log,
    get enabled() {
      return forceEnabled ?? topProps.enabled(namespace)
    },
    set enabled(value: boolean) {
      forceEnabled = value
    },
    extend: () => {}, // not implemented
  }

  const debugCall = (...args: any[]) => {
    const [format, ...rest] = args
    const { enabled, namespace: ns, color, log } = instanceProps

    // we push the args to our history of args
    if (args.length !== 0) {
      argsHistory.push([ns, ...args])
    }

    // if it is too big, then we remove some
    if (argsHistory.length > MAX_ARGS_HISTORY) {
      argsHistory.shift()
    }

    if (enabled) {
      const stringFormat = typeof format === 'string' ? format : JSON.stringify(format, null, 2)
      const stringArgs = rest.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))

      const ms = `+${Date.now() - lastTimestamp}ms`
      lastTimestamp = Date.now()

      if (globalThis.DEBUG_COLORS) {
        log(kleur[color](bold(ns)), stringFormat, ...stringArgs, kleur[color](ms))
      } else {
        log(ns, stringFormat, ...stringArgs, ms)
      }
    }
  }

  return new Proxy(debugCall, {
    get: (_, prop) => instanceProps[prop],
    set: (_, prop, value) => (instanceProps[prop] = value),
  }) as typeof debugCall & typeof instanceProps
}

const Debug = new Proxy(debugCreate, {
  get: (_, prop) => topProps[prop],
  set: (_, prop, value) => (topProps[prop] = value),
}) as typeof debugCreate & typeof topProps

/**
 * We can get the logs for all the last {@link MAX_ARGS_HISTORY} ${@link debugCall} that
 * have happened in the different packages. Useful to generate error report links.
 * @see https://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers
 * @param numChars
 * @returns
 */
export function getLogs(numChars = 7500): string {
  const logs = argsHistory
    .map(([ns, ...args]) => {
      return `${ns} ${args
        .map((arg) => {
          if (typeof arg === 'string') {
            return arg
          } else {
            return JSON.stringify(arg)
          }
        })
        .join(' ')}`
    })
    .join('\n')

  if (logs.length < numChars) {
    return logs
  }

  return logs.slice(-numChars)
}

export function clearLogs() {
  argsHistory.length = 0
}

export { Debug }
export default Debug
