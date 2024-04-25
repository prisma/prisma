/* eslint-disable no-var */
import * as kleur from 'kleur/colors'
import { bold } from 'kleur/colors'

const MAX_ARGS_HISTORY = 100
const COLORS = ['green', 'yellow', 'blue', 'magenta', 'cyan', 'red']

const argsHistory: [namespace: string, ...unknown[]][] = []
let lastTimestamp = Date.now()
let lastColor = 0

const processEnv = typeof process !== 'undefined' ? process.env : {}

globalThis.DEBUG ??= processEnv.DEBUG ?? ''
globalThis.DEBUG_COLORS ??= processEnv.DEBUG_COLORS ? processEnv.DEBUG_COLORS === 'true' : true

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
      globalThis.DEBUG = namespace
    }
  },
  disable() {
    const prev = globalThis.DEBUG
    globalThis.DEBUG = ''
    return prev
  },
  // this is the core logic to check if logging should happen or not
  enabled(namespace: string) {
    // these are the namespaces that we are listening to in DEBUG=...
    const listenedNamespaces: string[] = globalThis.DEBUG.split(',').map((s: string) => {
      return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&') // escape regex except "*"
    })

    // we take incoming namespaces and check then against listened
    const isListened = listenedNamespaces.some((listenedNamespace) => {
      if (listenedNamespace === '' || listenedNamespace[0] === '-') return false

      return namespace.match(RegExp(listenedNamespace.split('*').join('.*') + '$'))
    })

    // we take incoming namespaces and check then against excluded
    const isExcluded = listenedNamespaces.some((listenedNamespace) => {
      if (listenedNamespace === '' || listenedNamespace[0] !== '-') return false

      return namespace.match(RegExp(listenedNamespace.slice(1).split('*').join('.*') + '$'))
    })

    return isListened && !isExcluded
  },
  log: (...args: string[]) => {
    const [namespace, format, ...rest] = args
    let logger: (...args: unknown[]) => void

    if (
      typeof require === 'function' &&
      typeof process !== 'undefined' &&
      typeof process.stderr !== 'undefined' &&
      typeof process.stderr.write === 'function'
    ) {
      logger = (...args: unknown[]) => {
        // On react native util is not defined but the entire checks above pass
        // that's why we need to catch the error
        try {
          const util = require(`${'util'}`)
          process.stderr.write(util.format(...args) + '\n')
        } catch (e) {
          logger = console.warn ?? console.log
        }
      }
    } else {
      logger = console.warn ?? console.log
    }

    // console only formats first arg, concat ns+format
    logger(`${namespace} ${format}`, ...rest)
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
  const instanceProps = {
    color: COLORS[lastColor++ % COLORS.length],
    enabled: topProps.enabled(namespace),
    namespace: namespace,
    log: topProps.log,
    extend: () => {}, // not implemented
  }

  const debugCall = (...args: any[]) => {
    const { enabled, namespace, color, log } = instanceProps

    // we push the args to our history of args
    if (args.length !== 0) {
      argsHistory.push([namespace, ...args])
    }

    // if it is too big, then we remove some
    if (argsHistory.length > MAX_ARGS_HISTORY) {
      argsHistory.shift()
    }

    if (topProps.enabled(namespace) || enabled) {
      const stringArgs = args.map((arg) => {
        if (typeof arg === 'string') {
          return arg
        }

        return safeStringify(arg)
      })

      const ms = `+${Date.now() - lastTimestamp}ms`
      lastTimestamp = Date.now()

      if (globalThis.DEBUG_COLORS) {
        log(kleur[color](bold(namespace)), ...stringArgs, kleur[color](ms))
      } else {
        log(namespace, ...stringArgs, ms)
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

function safeStringify(value: any, indent = 2) {
  const cache = new Set<any>()

  return JSON.stringify(
    value,
    (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) {
          return `[Circular *]`
        }

        cache.add(value)
      } else if (typeof value === 'bigint') {
        return value.toString()
      }

      return value
    },
    indent,
  )
}

/**
 * We can get the logs for all the last {@link MAX_ARGS_HISTORY} ${@link debugCall} that
 * have happened in the different packages. Useful to generate error report links.
 * @see https://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers
 * @param numChars
 * @returns
 */
export function getLogs(numChars = 7500): string {
  const logs = argsHistory
    .map(([namespace, ...args]) => {
      return `${namespace} ${args
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
