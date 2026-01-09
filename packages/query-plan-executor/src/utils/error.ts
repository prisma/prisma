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

// A lenient regex to match connection strings in error messages.
// It might match some false positives, but that's acceptable for errors in the QPE.
// We do not want anything that looks like a connection string in the logs.
const CONNECTION_STRING_REGEX =
  /['"`]?(mysql|mariadb|postgresql|jdbc:sqlserver|sqlserver|sqlite|mongodb):\/\/[^\s]+['"`]?/gi

/**
 * Rethrows the given error after sanitizing its message by redacting
 * any connection strings found within it.
 */
export function rethrowSanitizedError(error: unknown): never {
  if (error instanceof Error) {
    error.message = error.message.replaceAll(CONNECTION_STRING_REGEX, '[REDACTED]')
  }
  throw error
}
