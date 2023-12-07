import { Cache } from '../../../generation/Cache'
import { CompositeProxyLayer } from './createCompositeProxy'

/**
 * Composite proxy layer that adds caching to another
 * layer.
 *
 * @param baseLayer
 * @returns
 */
export function cacheProperties<KeyType extends string | symbol>(
  baseLayer: CompositeProxyLayer<KeyType>,
): CompositeProxyLayer<KeyType> {
  const cache = new Cache<KeyType, unknown>()
  return {
    getKeys() {
      return baseLayer.getKeys()
    },

    getPropertyValue(key) {
      return cache.getOrCreate(key, () => baseLayer.getPropertyValue(key))
    },

    getPropertyDescriptor(key) {
      return baseLayer.getPropertyDescriptor?.(key)
    },
  }
}
