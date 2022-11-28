import { mapObjectValues } from '@prisma/internals'

import { Cache } from '../../../generation/Cache'
import { dmmfToJSModelName } from '../model/utils/dmmfToJSModelName'
import { Args, ResultArgsFieldCompute, ResultModelArgs } from './$extends'
import { Selection } from './visitQueryResult'

export type ComputedField = {
  name: string
  needs: string[]
  compute: ResultArgsFieldCompute
}

export type ComputedFieldsMap = {
  [fieldName: string]: ComputedField
}

/**
 * Given the list of extensions and dmmf model name, produces a map of all computed
 * fields that may be applied to this model.
 * All naming conflicts which could be produced by the plain list of extensions are resolved as follows:
 * - extension, that declared later always wins
 * - in a single extension, specific model takes precedence over $allModels
 *
 * Additionally, resolves all `needs` dependencies down to the model fields. For example,
 * if `nameAndTitle` field depends on `fullName` computed field and `title` model field and
 * `fullName` field depends on `firstName` and `lastName` field, full list of `nameAndTitle` dependencies
 * would be `firstName`, `lastName`, `title`.
 *
 * @param extensions
 * @param dmmfModelName
 * @returns
 */
export function getAllComputedFields(extensions: Args[], dmmfModelName: string): ComputedFieldsMap {
  // TODO: memoize the results
  const jsName = dmmfToJSModelName(dmmfModelName)
  const result = {} as ComputedFieldsMap

  for (const extension of extensions) {
    if (!extension.result) {
      continue
    }
    Object.assign(result, getComputedFieldsFromModel(extension.result.$allModels))
    Object.assign(result, getComputedFieldsFromModel(extension.result[jsName]))
  }

  return resolveDependencies(result)
}

export function resolveDependencies(computedFields: ComputedFieldsMap): ComputedFieldsMap {
  const cache = new Cache<string, string[]>()
  const resolveNeeds = (fieldName: string) => {
    return cache.getOrCreate(fieldName, () => {
      if (computedFields[fieldName]) {
        return computedFields[fieldName].needs.flatMap(resolveNeeds)
      }
      return [fieldName]
    })
  }

  return mapObjectValues(computedFields, (field) => {
    return {
      ...field,
      needs: resolveNeeds(field.name),
    }
  })
}

function getComputedFieldsFromModel(modelResult: ResultModelArgs | undefined): ComputedFieldsMap {
  if (!modelResult) {
    return {}
  }

  return mapObjectValues(modelResult, ({ needs, compute }, fieldName) => ({
    name: fieldName,
    needs: needs ? Object.keys(needs).filter((key) => needs[key]) : [],
    compute,
  }))
}

export function applyComputedFieldsToSelection(selection: Selection, computedFields: ComputedFieldsMap): Selection {
  const result = { ...selection }

  for (const field of Object.values(computedFields)) {
    if (!selection[field.name]) {
      continue
    }

    for (const dependency of field.needs) {
      result[dependency] = true
    }
  }
  return result
}
