declare let self: unknown

/**
 * Detects the runtime environment
 * @returns
 */
export function getJSRuntimeName() {
  if (typeof self === 'undefined') {
    return 'node'
  }

  return 'browser'
}
