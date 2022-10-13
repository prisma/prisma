import { defaultProxyHandlers } from '../model/utils/defaultProxyHandlers'

export interface CompositeProxyLayer<KeyType extends string | symbol = string | symbol> {
  /**
   * Returns a list of keys, defined by a layer
   */
  getKeys(): KeyType[]

  /**
   * Returns a value for a property for a given key (one of the keys, returned
   * from `getKeys`)
   * @param key
   */
  getPropertyValue(key: KeyType): unknown
}

/**
 * Creates a proxy from a set of layers.
 * Each layer is a building for a proxy (potentially, reusable) that
 * can add or override property on top of the target.
 * When multiple layers define the same property, last one wins
 *
 * @param target
 * @param layers
 * @returns
 */
export function createCompositeProxy<T extends object>(target: T, layers: CompositeProxyLayer[]): T {
  const keysToLayerMap = mapKeysToLayers(layers)
  const ownKeys = getOwnKeys(target, Array.from(keysToLayerMap.keys()))

  return new Proxy(target, {
    get(target, prop) {
      const layer = keysToLayerMap.get(prop)
      if (layer) {
        return layer.getPropertyValue(prop)
      }

      if (prop in target) {
        return target[prop]
      }

      return undefined
    },
    ...defaultProxyHandlers(ownKeys),
  })
}

function mapKeysToLayers(layers: CompositeProxyLayer[]) {
  const keysToLayerMap = new Map<string | symbol, CompositeProxyLayer>()
  for (const layer of layers) {
    const keys = layer.getKeys()
    for (const key of keys) {
      keysToLayerMap.set(key, layer)
    }
  }
  return keysToLayerMap
}

function getOwnKeys(target: object, layerKeys: (string | symbol)[]) {
  const set = new Set([...Object.keys(target), ...layerKeys])
  return Array.from(set)
}
