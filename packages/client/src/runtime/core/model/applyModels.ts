import type { Client } from '../../getPrismaClient'
import { applyModel } from './applyModel'
import { jsToDMMFModelName } from './utils/jsToDMMFModelName'

/**
 * Dynamically creates a model proxy interface for a give name. For each prop
 * accessed on this proxy, it will lookup the dmmf to find if that model exists.
 * If it is the case, it will create a proxy for that model via {@link applyModel}.
 * @param client to create the proxy around
 * @returns a proxy to access models
 */
export function applyModels<C extends Client>(client: C) {
  // we don't want to create a new proxy on each prop access
  const modelCache = {} as { [key: string]: object }

  return new Proxy(client, {
    get(target, prop: string) {
      // for any prop that is accessed, we get its dmmf name
      const dmmfModelName = jsToDMMFModelName(prop)

      // see if a model proxy has already been created before
      if (modelCache[dmmfModelName] !== undefined) {
        return modelCache[dmmfModelName]
      }

      // creates a new model proxy on the fly and caches it
      if (client._dmmf.modelMap[dmmfModelName] !== undefined) {
        return (modelCache[dmmfModelName] = applyModel(client, dmmfModelName))
      }

      // above just failed if the model name is lower cased
      if (client._dmmf.modelMap[prop] !== undefined) {
        return (modelCache[prop] = applyModel(client, prop))
      }

      return target[prop] // returns the base client prop
    },
  })
}
