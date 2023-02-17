import { generateClient, SchemaParams } from './generateClient'
import { getRangeIterator, Range } from './range'
import { Target } from './targets/base'

export type MeasurementResult = {
  numModels: number
  numRelations: number
  numEnums: number
  [key: string]: number
}

export async function measureOne(workbenchPath: string, schemaParams: SchemaParams): Promise<MeasurementResult> {
  await generateClient(workbenchPath, schemaParams)
  const measurements = await schemaParams.target.measure(workbenchPath)
  return {
    numModels: schemaParams.numModels,
    numRelations: schemaParams.numModels,
    numEnums: schemaParams.numEnums,
    ...measurements,
  }
}

export type MeasureMultipleParams = {
  target: Target
  workbenchPath: string
  models: Range
  relations: Range
  enums: Range
  features: string[]
  dataProxy: boolean
}

export async function* measureMultiple({
  target,
  workbenchPath,
  models,
  relations,
  enums,
  features,
  dataProxy,
}: MeasureMultipleParams): AsyncGenerator<MeasurementResult> {
  for (const { numModels, numRelations, numEnums } of getRangeIterator(models, relations, enums)) {
    console.log(`measuring schema with ${numModels} models, ${numRelations} relations and ${numEnums} enums`)
    yield await measureOne(workbenchPath, { target, numModels, numRelations, numEnums, features, dataProxy })
  }
}
