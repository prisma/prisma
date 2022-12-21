import type { DMMF as ExternalDMMF } from '@prisma/generator-helper'
import pluralize from 'pluralize'

import type { DMMF } from './dmmf-types'
import { capitalize, lowerCase } from './utils/common'

export function getCountAggregateOutputName(modelName: string): string {
  return `${capitalize(modelName)}CountAggregateOutputType`
}

/**
 * Turns type: string into type: string[] for all args in order to support union input types
 * @param document
 */
export function externalToInternalDmmf(document: ExternalDMMF.Document): DMMF.Document {
  return {
    ...document,
    mappings: getMappings(document.mappings, document.datamodel),
  }
}

function getMappings(mappings: ExternalDMMF.Mappings, datamodel: DMMF.Datamodel): DMMF.Mappings {
  const modelOperations = mappings.modelOperations
    .filter((mapping) => {
      const model = datamodel.models.find((m) => m.name === mapping.model)
      if (!model) {
        throw new Error(`Mapping without model ${mapping.model}`)
      }
      return model.fields.some((f) => f.kind !== 'object')
    })
    // TODO most of this is probably not needed anymore
    .map((mapping: any) => ({
      model: mapping.model,
      plural: pluralize(lowerCase(mapping.model)), // TODO not needed anymore
      findUnique: mapping.findUnique || mapping.findSingle,
      findUniqueOrThrow: mapping.findUniqueOrThrow,
      findFirst: mapping.findFirst,
      findFirstOrThrow: mapping.findFirstOrThrow,
      findMany: mapping.findMany,
      create: mapping.createOne || mapping.createSingle || mapping.create,
      createMany: mapping.createMany,
      delete: mapping.deleteOne || mapping.deleteSingle || mapping.delete,
      update: mapping.updateOne || mapping.updateSingle || mapping.update,
      deleteMany: mapping.deleteMany,
      updateMany: mapping.updateMany,
      upsert: mapping.upsertOne || mapping.upsertSingle || mapping.upsert,
      aggregate: mapping.aggregate,
      groupBy: mapping.groupBy,
      findRaw: mapping.findRaw,
      aggregateRaw: mapping.aggregateRaw,
    }))

  return {
    modelOperations,
    otherOperations: mappings.otherOperations,
  }
}
