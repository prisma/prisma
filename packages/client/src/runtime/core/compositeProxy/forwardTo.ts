import type { CompositeProxyLayer } from './createCompositeProxy'

/**
 * Composite proxy layer that forwards all reads
 * to provided object
 *
 * @param object
 * @returns
 */
export function forwardTo(object: object): CompositeProxyLayer {
  return {
    getKeys() {
      return Object.keys(object)
    },

    getPropertyValue(key) {
      return object[key]
    },
  }
}
