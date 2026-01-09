/**
 * Returns an {@link Error} if the value is an instance of Error, otherwise
 * returns a string representation of the value.
 */
export function extractErrorFromUnknown(value: unknown): Error | string {
  if (value instanceof Error) {
    return value
  }
  return String(value)
}

/**
 * Rethrows the given error after sanitizing its message by redacting
 * any connection strings found within it.
 */
export function rethrowSanitizedError(error: unknown, protocols: string[]): never {
  if (typeof error === 'object' && error !== null) {
    sanitizeError(error, createConnectionStringRegex(protocols))
  }
  throw error
}

function sanitizeError(error: object, regex: RegExp, visited: WeakSet<object> = new WeakSet()) {
  if (visited.has(error)) {
    return
  }
  visited.add(error)

  for (const key of Object.getOwnPropertyNames(error)) {
    const value = error[key]
    if (typeof value === 'string') {
      error[key] = value.replaceAll(regex, '[REDACTED]')
    } else if (typeof value === 'object' && value !== null) {
      sanitizeError(value as object, regex, visited)
    }
  }
}

function createConnectionStringRegex(protocols: string[]) {
  const escapedProtocols = protocols.join('|')

  // A lenient regex to match connection strings in error messages.
  // It might match some false positives, but that's acceptable for errors in the QPE.
  // We do not want anything that looks like a connection string in the logs.
  const pattern = [
    `['"\`]?`, // Optional opening quote
    `(${escapedProtocols})`, // Protocol group
    `:\\/\\/`, // Protocol separator
    `[^\\s]+`, // Connection string body
    `['"\`]?`, // Optional closing quote
  ].join('')

  return new RegExp(pattern, 'gi')
}
