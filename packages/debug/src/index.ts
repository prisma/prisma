import debug from 'debug'

const cache: any[] = []

const MAX_LOGS = 100

/**
 * Wrapper on top of the original `Debug` to keep a history of the all last
 * {@link MAX_LOGS}. This is then used by {@link getLogs} to generate an error
 * report url (forGitHub) in the case where the something has crashed.
 * @param namespace
 * @returns
 */
export default function Debug(namespace: string) {
  const debugNamespace = debug(namespace)

  return (...args: any[]) => {
    cache.push(args)

    if (cache.length > MAX_LOGS) {
      cache.shift()
    }

    // @ts-ignore
    debugNamespace(...args)
  }
}

export { Debug }

Debug.enable = (namespace: string): void => {
  debug.enable(namespace)
}

Debug.enabled = (namespace: string): boolean => debug.enabled(namespace)

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
