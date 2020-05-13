import DebugLib from 'debug'

const cache: any[] = []

const MAX_LOGS = 100

const namespaces: string[] = []

// for our use-case, map is faster, as retrieving values is faster than with Set or Object
const enabledNamespaces: Map<string, true> = new Map<string, true>()

// parse the enabled namespaces that come from process.env.DEBUG
const envDebug = process.env.DEBUG ? process.env.DEBUG + ',' : ''
const skips = DebugLib.skips.slice()
const names = DebugLib.names.slice()

// same algorithm as original `debug` library:
function isEnabledByEnvVar(name: string): boolean {
  if (name[name.length - 1] === '*') {
    return true
  }

  for (const skip of skips) {
    if (skip.test(name)) {
      return false
    }
  }

  for (const nameRegex of names) {
    if (nameRegex.test(name)) {
      return true
    }
  }

  return false
}

export default function Debug(namespace: string): DebugLib.Debugger {
  const debug: DebugLib.Debugger = DebugLib(namespace)
  namespaces.push(namespace)
  DebugLib.enable(envDebug + namespaces.join(','))

  if (isEnabledByEnvVar(namespace)) {
    enabledNamespaces.set(namespace, true)
  }

  const newDebug = (formatter: any, ...args: any[]) => {
    return debug(formatter, ...args)
  }

  newDebug.log = console.error.bind(console)
  newDebug.color = debug.color
  newDebug.namespace = debug.namespace
  newDebug.enabled = debug.enabled
  newDebug.destroy = debug.destroy
  newDebug.extend = debug.extend

  debug.log = (...args): void => {
    cache.push(args)
    // keeping 100 logs is just a heuristic. The real truncating comes later
    if (cache.length > MAX_LOGS) {
      cache.shift()
    }
    if (enabledNamespaces.has(namespace)) {
      newDebug.log(...args)
    }
  }

  return newDebug
}

Debug.enable = (namespace: string): void => {
  enabledNamespaces.set(namespace, true)
}

Debug.enabled = (namespace: string): boolean => enabledNamespaces.has(namespace)

export declare type Debugger = DebugLib.Debugger

export function getLogs(numLines = 100): string {
  // flatmap on text level
  const lines = cache
    .map((c) => c.join('  '))
    .join('\n')
    .split('\n') // no this is not a no-op
  if (lines.length <= numLines) {
    return lines.join('\n')
  }
  return lines.slice(-numLines).join('\n')
}
