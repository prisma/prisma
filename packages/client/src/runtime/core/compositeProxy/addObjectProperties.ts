import type { CompositeProxyLayer } from './createCompositeProxy'

/**
 * Composite proxy layer that forwards all property reads
 * to the provided object.
 *
 * @param object The target object whose properties will be exposed through the proxy layer.
 * @returns A composite proxy layer that reads values directly from the provided object.
 *
 * @example
 * const layer = addObjectProperties({ name: 'Alice', age: 20 })
 * layer.getPropertyValue('name') // 'Alice'
 */


export function addObjectProperties(object: object): CompositeProxyLayer {
  return {
    getKeys() {
      return Object.keys(object)
    },

    getPropertyValue(key) {
      return object[key]
    },
  }
}
