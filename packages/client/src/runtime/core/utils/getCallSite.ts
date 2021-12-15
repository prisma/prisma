/**
 * Gets information about where this was called from.
 * @param errorFormat
 * @returns
 */
export function getCallSite(errorFormat?: string) {
  if (errorFormat === 'minimal') {
    return undefined
  }

  const originalError = new Error()
  const stack = originalError.stack

  return stack
}
