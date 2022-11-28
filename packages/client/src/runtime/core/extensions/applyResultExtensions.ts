import { hasOwnProperty } from '@prisma/internals'

import {
  addProperty,
  cacheProperties,
  CompositeProxyLayer,
  createCompositeProxy,
  removeProperties,
} from '../compositeProxy'
import { Args } from './$extends'
import { ComputedField, getAllComputedFields } from './resultUtils'
import { Selection } from './visitQueryResult'

type ApplyExtensionsArgs = {
  result: object
  select?: Selection
  modelName: string
  extensions: Args[]
}

/**
 * Given a part of a query result, it's model name and a list of extension,
 * applies computed fields to the results. Fields are computed lazily on a first access,
 * after that the result of computation is cached. In case `select` is used, all dependencies
 * of the computed fields would be excluded from final result, unless they are also specified in the select.
 *
 * This function applies computed fields to a single object only: it does not traverse relationships.
 * For full functionality, it is meant to be combined with `visitQueryResult`.
 *
 * @param params
 * @returns
 */
export function applyResultExtensions({ result, modelName, select, extensions }: ApplyExtensionsArgs) {
  const computedFields = getAllComputedFields(extensions, modelName)

  const computedPropertiesLayers: CompositeProxyLayer[] = []
  const maskingLayers: CompositeProxyLayer[] = []

  for (const field of Object.values(computedFields)) {
    if (select) {
      if (!select[field.name]) {
        continue
      }

      const toMask = field.needs.filter((prop) => !select[prop])
      if (toMask.length > 0) {
        maskingLayers.push(removeProperties(toMask))
      }
    }

    if (areNeedsMet(result, field.needs)) {
      computedPropertiesLayers.push(
        computedPropertyLayer(field, createCompositeProxy(result, computedPropertiesLayers)),
      )
    }
  }

  if (computedPropertiesLayers.length > 0 || maskingLayers.length > 0) {
    return createCompositeProxy(result, [...computedPropertiesLayers, ...maskingLayers])
  }
  return result
}

function areNeedsMet(result: object, neededProperties: string[]) {
  return neededProperties.every((property) => hasOwnProperty(result, property))
}

function computedPropertyLayer(field: ComputedField, result: object): CompositeProxyLayer {
  return cacheProperties(addProperty(field.name, () => field.compute(result)))
}
