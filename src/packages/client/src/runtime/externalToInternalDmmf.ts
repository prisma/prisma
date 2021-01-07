import { DMMF as ExternalDMMF } from '@prisma/generator-helper'
import pluralize from 'pluralize'
import { DMMF } from './dmmf-types'
import { capitalize, lowerCase } from './utils/common'

export function getCountAggregateOutputName(modelName: string): string {
  return `${capitalize(modelName)}CountAggregateOutputType`
}

/**
 * Turns type: string into type: string[] for all args in order to support union input types
 * @param document
 */
export function externalToInternalDmmf(
  document: ExternalDMMF.Document,
): DMMF.Document {
  return {
    ...renameAllCount(document),
    mappings: getMappings(document.mappings, document.datamodel),
  }
}
function fromEntries<T> (iterable: Array<[string, T]>): { [key: string]: T } {
  return [...iterable].reduce<{ [key: string]: T }>((obj, [key, val]) => {
    obj[key] = val
    return obj
  }, {})
}
/**
 * Renames _all in the query engine dmmf to $all
 * @param document DMMF.Document to transform
 */
function renameAllCount(document: DMMF.Document): DMMF.Document {
  const countTypeNames = fromEntries(
    document.mappings.modelOperations.map((o) => [
      getCountAggregateOutputName(o.model),
      true,
    ]),
  )

  for (const type of document.schema.outputObjectTypes.prisma) {
    if (countTypeNames[type.name]) {
      const allField = type.fields.find((f) => f.name === '_all')
      if (allField) {
        allField.name = '$all'
      }
    }
  }

  return document
}

function getMappings(
  mappings: ExternalDMMF.Mappings,
  datamodel: DMMF.Datamodel,
): DMMF.Mappings {
  const modelOperations = mappings.modelOperations
    .filter((mapping) => {
      const model = datamodel.models.find((m) => m.name === mapping.model)
      if (!model) {
        throw new Error(`Mapping without model ${mapping.model}`)
      }
      return model.fields.some((f) => f.kind !== 'object')
    })
    .map((mapping: any) => ({
      model: mapping.model,
      plural: pluralize(lowerCase(mapping.model)),
      findUnique: mapping.findSingle || mapping.findOne,
      findFirst: mapping.findFirst,
      findMany: mapping.findMany,
      create: mapping.createOne || mapping.createSingle || mapping.create,
      delete: mapping.deleteOne || mapping.deleteSingle || mapping.delete,
      update: mapping.updateOne || mapping.updateSingle || mapping.update,
      deleteMany: mapping.deleteMany,
      updateMany: mapping.updateMany,
      upsert: mapping.upsertOne || mapping.upsertSingle || mapping.upsert,
      aggregate: mapping.aggregate,
      groupBy: mapping.groupBy,
    }))

  return {
    modelOperations,
    otherOperations: mappings.otherOperations,
  }
}
