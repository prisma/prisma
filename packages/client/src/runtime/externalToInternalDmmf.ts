import type { DMMF as ExternalDMMF } from '@prisma/generator-helper'

import type { DMMF } from '../generation/dmmf-types'
import { capitalize } from '../generation/utils/common'

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
      findUnique: mapping.findUnique,
      findUniqueOrThrow: mapping.findUniqueOrThrow,
      findFirst: mapping.findFirst,
      findFirstOrThrow: mapping.findFirstOrThrow,
      findMany: mapping.findMany,
      create: mapping.createOne,
      createMany: mapping.createMany,
      delete: mapping.deleteOne,
      update: mapping.updateOne,
      deleteMany: mapping.deleteMany,
      updateMany: mapping.updateMany,
      upsert: mapping.upsertOne,
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
