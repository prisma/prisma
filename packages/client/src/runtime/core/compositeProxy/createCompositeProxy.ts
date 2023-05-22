import { inspect, type InspectOptions } from 'util'

import { defaultPropertyDescriptor } from '../model/utils/defaultProxyHandlers'

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

  /**
   * Gets a descriptor for given property. If not implemented or undefined is returned, { enumerable: true, writeable: true, configurable: true} is defaulted
   * is used
   * @param key
   */
  getPropertyDescriptor?(key: KeyType): PropertyDescriptor | undefined

  /**
   * Allows to override results for hasOwnProperty/in operator. If not implemented, returns true
   * @param key
   */
  has?(key: KeyType): boolean
}

const customInspect = Symbol.for('nodejs.util.inspect.custom')

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
  const overwrittenKeys = new Set<string | symbol>()

  const proxy = new Proxy(target, {
    get(target, prop) {
      // explicit overwrites of a property have highest priority
      if (overwrittenKeys.has(prop)) {
        return target[prop]
      }

      // next, we see if property is defined in one of the layers
      const layer = keysToLayerMap.get(prop)
      if (layer) {
        return layer.getPropertyValue(prop)
      }

      // finally, we read a prop from target
      return target[prop]
    },

    has(target, prop) {
      if (overwrittenKeys.has(prop)) {
        return true
      }
      const layer = keysToLayerMap.get(prop)
      if (layer) {
        return layer.has?.(prop) ?? true
      }

      return Reflect.has(target, prop)
    },

    ownKeys(target) {
      const targetKeys = getExistingKeys(Reflect.ownKeys(target), keysToLayerMap)
      const layerKeys = getExistingKeys(Array.from(keysToLayerMap.keys()), keysToLayerMap)
      return [...new Set([...targetKeys, ...layerKeys, ...overwrittenKeys])]
    },

    set(target, prop, value) {
      const layer = keysToLayerMap.get(prop)
      if (layer?.getPropertyDescriptor?.(prop)?.writable === false) {
        return false
      }
      overwrittenKeys.add(prop)
      return Reflect.set(target, prop, value)
    },

    getOwnPropertyDescriptor(target, prop) {
      const layer = keysToLayerMap.get(prop)
      if (layer) {
        if (layer.getPropertyDescriptor) {
          return {
            ...defaultPropertyDescriptor,
            ...layer?.getPropertyDescriptor(prop),
          }
        }
        return defaultPropertyDescriptor
      }

      return Reflect.getOwnPropertyDescriptor(target, prop)
    },

    defineProperty(target, property, attributes) {
      overwrittenKeys.add(property)
      return Reflect.defineProperty(target, property, attributes)
    },
  })

  proxy[customInspect] = function (depth: number, options: InspectOptions, defaultInspect: typeof inspect = inspect) {
    // Default node.js console.log and util.inspect deliberately avoid triggering any proxy traps and log
    // original target. This is not we want for our usecases: we want console.log to output the result as if
    // the properties actually existed on the target. Using spread operator forces us to produce correct object
    const toLog = { ...this }
    delete toLog[customInspect]
    return defaultInspect(toLog, options)
  }
  return proxy
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

function getExistingKeys(keys: Array<string | symbol>, keysToLayerMap: Map<string | symbol, CompositeProxyLayer>) {
  return keys.filter((key) => {
    const layer = keysToLayerMap.get(key)
    return layer?.has?.(key) ?? true
  })
}
