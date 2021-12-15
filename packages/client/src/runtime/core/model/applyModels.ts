import type { DMMFHelper } from '../../dmmf'
import type { InternalRequestParams } from '../../getPrismaClient'
import { applyModel } from './applyModel'
import { jsToDMMFModelName } from './utils/jsToDMMFModelName'

/**
 * Dynamically creates a model proxy interface for a give name. For each prop
 * accessed on this proxy, it will lookup the dmmf to find if that model exists.
 * If it is the case, it will create a proxy for that model via {@link applyModel}.
 * @param request to trigger the request execution
 * @param baseClient to create the proxy around
 * @param dmmfHelper to provide dmmf information
 * @returns a proxy to access models
 */
export function applyModels<C extends object>(
  request: (internalParams: InternalRequestParams) => Promise<unknown>,
  baseClient: C,
  dmmfHelper: DMMFHelper,
) {
  // we don't want to create a new proxy on each prop access
  const modelCache = {} as { [key: string]: object }

  return new Proxy(baseClient, {
    get(target, prop: string) {
      // for any prop that is accessed, we get its dmmf name
      const dmmfModelName = jsToDMMFModelName(prop)

      // check if a model proxy has already been created before
      if (modelCache[dmmfModelName] !== undefined) {
        return modelCache[dmmfModelName]
      }

      // creates a new model proxy on the fly and caches it
      if (dmmfHelper.modelMap[dmmfModelName] !== undefined) {
        const model = applyModel(request, dmmfHelper, dmmfModelName)

        return (modelCache[dmmfModelName] = model)
      }

      return target[prop] // returns the base client prop
    },
  })
}
