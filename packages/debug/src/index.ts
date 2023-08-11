import debug from 'debug'

import { Debug, Debugger } from './types'

const MAX_LOGS = 100

const debugArgsHistory: any[] = []

// Patch the Node.js logger to use `console.debug` or `console.log` (similar to
// the browser logger) in the Edge Client.
if (typeof process !== 'undefined' && typeof process.stderr?.write !== 'function') {
  debug.log = console.debug ?? console.log
}

/**
 * Wrapper on top of the original `Debug` to keep a history of the all last
 * {@link MAX_LOGS}. This is then used by {@link getLogs} to generate an error
 * report url (forGitHub) in the case where the something has crashed.
 * @param namespace
 * @returns
 */
function debugCall(namespace: string) {
  const debugNamespace = debug(namespace)

  // we take over the `debugNamespace` function
  const call = Object.assign((...args: any[]) => {
    // debug only calls log if you implement it
    debugNamespace.log = (call as any).log

    // we push the args to our history of args
    if (args.length !== 0) {
      debugArgsHistory.push([namespace, ...args])
    }

    // if it is too big, then we remove some
    if (debugArgsHistory.length > MAX_LOGS) {
      debugArgsHistory.shift()
    }

    // we apply the function with no format
    return debugNamespace('', ...args)
  }, debugNamespace)

  return call as Debugger
}

/**
 * This essentially mimics the original `debug` api. It is a debug function call
 * that has utility properties on it. We provide our custom {@link debugCall},
 * and expose the original original api as-is.
 */
const Debug = Object.assign(debugCall, debug as Debug)

/**
 * We can get the logs for all the last {@link MAX_LOGS} ${@link debugCall} that
 * have happened in the different packages. Useful to generate error report links.
 * @see https://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers
 * @param numChars
 * @returns
 */
export function getLogs(numChars = 7500): string {
  // flatmap on text level
  const output = debugArgsHistory
    .map((c) =>
      c
        .map((item) => {
          if (typeof item === 'string') {
            return item
          }

          return JSON.stringify(item)
        })
        .join(' '),
    )
    .join('\n')

  if (output.length < numChars) {
    return output
  }

  return output.slice(-numChars)
}

export function clearLogs() {
  debugArgsHistory.length = 0
}

export { Debug }
export default Debug
