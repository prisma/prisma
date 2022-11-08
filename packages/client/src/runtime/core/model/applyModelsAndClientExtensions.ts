import type { Client } from '../../getPrismaClient'
import {
  addObjectProperties,
  addProperty,
  cacheProperties,
  CompositeProxyLayer,
  createCompositeProxy,
} from '../compositeProxy'
import { applyModel } from './applyModel'
import { dmmfToJSModelName } from './utils/dmmfToJSModelName'
import { jsToDMMFModelName } from './utils/jsToDMMFModelName'

// symbol we use for storing raw, unproxied
// client instance, so we later can retrieve it
// via `unapplyModels` methods
const rawClient = Symbol()

/**
 * Dynamically creates a model proxy interface for a give name. For each prop
 * accessed on this proxy, it will lookup the dmmf to find if that model exists.
 * If it is the case, it will create a proxy for that model via {@link applyModel}.
 * @param client to create the proxy around
 * @returns a proxy to access models
 */
export function applyModelsAndClientExtensions(client: Client) {
  const layers = [modelsLayer(client), addProperty(rawClient, () => client)]
  for (const extension of client._extensions) {
    if (extension.client) {
      layers.push(addObjectProperties(extension.client))
    }
  }
  return createCompositeProxy(client, layers)
}

function modelsLayer(client: Client): CompositeProxyLayer {
  const dmmfModelKeys = Object.keys(client._baseDmmf.modelMap)
  const jsModelKeys = dmmfModelKeys.map(dmmfToJSModelName)
  const allKeys = [...new Set(dmmfModelKeys.concat(jsModelKeys))]

  return cacheProperties({
    getKeys() {
      return allKeys
    },

    getPropertyValue(prop) {
      const dmmfModelName = jsToDMMFModelName(prop)
      // creates a new model proxy on the fly and caches it
      if (client._baseDmmf.modelMap[dmmfModelName] !== undefined) {
        return applyModel(client, dmmfModelName)
      }

      // above silently failed if model name is lower cased
      if (client._baseDmmf.modelMap[prop] !== undefined) {
        return applyModel(client, prop)
      }

      return undefined
    },

    getPropertyDescriptor(key) {
      if (!jsModelKeys.includes(key)) {
        return { enumerable: false }
      }

      return undefined
    },
  })
}

export function unapplyModelsAndClientExtensions(client: Client): Client {
  if (client[rawClient]) {
    return client[rawClient]
  }
  return client
}
