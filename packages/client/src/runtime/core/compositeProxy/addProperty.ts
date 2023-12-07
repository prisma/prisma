import { CompositeProxyLayer } from './createCompositeProxy'

/**
 * Composite proxy layer, that adds a single property to the target
 * @param key  the name of the property
 * @param factory the function that returns the value of the property
 * @returns
 */
export function addProperty(key: string | symbol, factory: () => unknown): CompositeProxyLayer {
  return {
    getKeys() {
      return [key]
    },

    getPropertyValue() {
      return factory()
    },
  }
}
