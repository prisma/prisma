import DebugLib from 'debug'

const cache: any[] = []

const MAX_LOGS = 100

const namespaces: string[] = []

// for our use-case, map is faster, as retrieving values is faster than with Set or Object
const enabledNamespaces: Map<string, true> = new Map<string, true>()

export default function Debug(namespace: string): DebugLib.Debugger {
  const debug: any = DebugLib(namespace)
  namespaces.push(namespace)

  DebugLib.enable(namespaces.join(','))

  debug.log = (...args): void => {
    cache.push(args)
    // keeping 100 logs is just a heuristic. The real truncating comes later
    if (cache.length > MAX_LOGS) {
      cache.shift()
    }
    if (enabledNamespaces.has(namespace)) {
      console.error(...args)
    }
  }

  return debug
}

Debug.enable = (namespace): void => {
  enabledNamespaces.set(namespace, true)
}

Debug.enabled = (namespace): boolean => enabledNamespaces.has(namespace)

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
