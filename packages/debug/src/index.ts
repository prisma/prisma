/* eslint-disable no-var */
import * as kleur from 'kleur/colors'
import { bold } from 'kleur/colors'

const MAX_ARGS_HISTORY = 100
const COLORS = ['green', 'yellow', 'blue', 'magenta', 'cyan', 'red']

const argsHistory: [namespace: string, ...unknown[]][] = []
let lastTimestamp = Date.now()
let lastColor = 0

globalThis.DEBUG ??= process.env.DEBUG ?? ''
globalThis.DEBUG_COLORS ??= process.env.DEBUG_COLORS ? process.env.DEBUG_COLORS === 'true' : true

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
    const listenedNamespaces: string[] = globalThis.DEBUG.split(',')

    // we take incoming namespaces and check then against listened
    return listenedNamespaces.every((listenedNamespace) => {
      // namespaces can be negated with a `-` prefix (exclusions)
      const isNegated = listenedNamespace.startsWith('-') ? 1 : 0
      listenedNamespace = listenedNamespace.slice(isNegated)

      // we split the namespaces by `:` to be able to compare them
      let emittedParts = namespace.split(':')
      let listenedParts = listenedNamespace.split(':')
      const sizeDiff = listenedParts.length - emittedParts.length

      // here we make that the two compared arrays have the same length
      if (listenedParts.length > emittedParts.length) {
        emittedParts = [...emittedParts, ...Array(Math.abs(sizeDiff)).fill(undefined)]
      } else if (listenedParts.length < emittedParts.length) {
        // if the last part is a wildcard, we fill the rest with wildcards
        const filler = listenedParts[listenedParts.length - 1] === '*' ? '*' : undefined
        listenedParts = [...listenedParts, ...Array(Math.abs(sizeDiff)).fill(filler)]
      }

      // matches if each part is equal or if the listened part is a wildcard
      const matched = listenedParts.every((listenedPart, i) => {
        return listenedPart === emittedParts[i] || (emittedParts[i] && listenedPart === '*')
      })

      return isNegated ? !matched : matched // flip the result if negated
    })
  },
  log: (...args: string[]) => {
    const [ns, format, ...rest] = args
    // concat `ns`+`format` because console only formats first arg
    console.warn(`${ns} ${format}`, ...rest)
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

        return JSON.stringify(arg, null, 2)
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
