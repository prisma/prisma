import { mapObjectValues } from '@prisma/internals'

import { Cache } from '../../../generation/Cache'
import { dmmfToJSModelName } from '../model/utils/dmmfToJSModelName'
import { Args, ResultArgsFieldCompute, ResultModelArgs } from './$extends'
import { Selection } from './visitQueryResult'
import { wrapExtensionCallback } from './wrapExtensionCallback'

export type ComputedField = {
  name: string
  needs: string[]
  compute: ResultArgsFieldCompute
}

export type ComputedFieldsMap = {
  [fieldName: string]: ComputedField
}

/**
 * Given the list of previously resolved computed fields, new extension and dmmf model name, produces a map
 * of all computed fields that may be applied to this model, accounting for all previous and past extensions.
 *
 * All naming conflicts which could be produced by the plain list of extensions are resolved as follows:
 * - extension, that declared later always wins
 * - in a single extension, specific model takes precedence over $allModels
 *
 * Additionally, resolves all `needs` dependencies down to the model fields. For example,
 * if `nameAndTitle` field depends on `fullName` computed field and `title` model field and
 * `fullName` field depends on `firstName` and `lastName` field, full list of `nameAndTitle` dependencies
 * would be `firstName`, `lastName`, `title`.
 * @param previousComputedFields
 * @param extension
 * @param dmmfModelName
 * @returns
 */
export function getComputedFields(
  previousComputedFields: ComputedFieldsMap | undefined,
  extension: Args,
  dmmfModelName: string,
) {
  const jsName = dmmfToJSModelName(dmmfModelName)
  if (!extension.result || !(extension.result.$allModels || extension.result[jsName])) {
    return previousComputedFields
  }

  return resolveDependencies({
    ...previousComputedFields,
    ...getComputedFieldsFromModel(extension.name, extension.result.$allModels),
    ...getComputedFieldsFromModel(extension.name, extension.result[jsName]),
  })
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

function getComputedFieldsFromModel(
  name: string | undefined,
  modelResult: ResultModelArgs | undefined,
): ComputedFieldsMap {
  if (!modelResult) {
    return {}
  }

  return mapObjectValues(modelResult, ({ needs, compute }, fieldName) => ({
    name: fieldName,
    needs: needs ? Object.keys(needs).filter((key) => needs[key]) : [],
    compute: wrapExtensionCallback(name, compute),
  }))
}

export function applyComputedFieldsToSelection(
  selection: Selection,
  computedFields: ComputedFieldsMap | undefined,
): Selection {
  if (!computedFields) {
    return selection
  }
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
