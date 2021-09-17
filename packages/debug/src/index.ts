import 'debug'
import DebugNode from './node'

const cache: any[] = []

const MAX_LOGS = 100

export default function Debug(namespace: string): debug.Debugger {
  const debug: debug.Debugger = DebugNode(namespace, (...args) => {
    cache.push(args)
    // keeping 100 logs is just a heuristic. The real truncating comes later
    if (cache.length > MAX_LOGS) {
      cache.shift()
    }
  })

  return debug
}

export { Debug }

Debug.enable = (namespace: string): void => {
  DebugNode.enable(namespace)
}

Debug.enabled = (namespace: string): boolean => DebugNode.enabled(namespace)

// https://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers
// we need some space for other characters, so we go for 30k here
export function getLogs(numChars = 7500): string {
  // flatmap on text level
  const output = cache
    .map((c) =>
      c
        .map((item) => {
          if (typeof item === 'string') {
            return item
          }

          return JSON.stringify(item)
        })
        .join('  '),
    )
    .join('\n')

  if (output.length < numChars) {
    return output
  }

  return output.slice(-numChars)
}
