/**
 * Gets information about where this was called from.
 * @param errorFormat
 * @returns
 */
export function getCallSite(errorFormat?: string) {
  if (errorFormat === 'minimal') {
    return undefined
  }

  return new Error().stack
}
