import { NodeEngine } from '@prisma/engine-core/dist/NodeEngine'
import path from 'path'
import { DMMF, ExternalDMMF } from '../runtime/dmmf-types'
import { externalToInternalDmmf } from '../runtime/externalToInternalDmmf'
import { transformDmmf } from '../runtime/transformDmmf'

const modelBlacklist = {
  // helper types
  Enumerable: true,
  MergeTruthyValues: true,
  CleanupNever: true,
  AtLeastOne: true,
  OnlyOne: true,
  // scalar filters
  StringFilter: true,
  IDFilter: true,
  FloatFilter: true,
  IntFilter: true,
  BooleanFilter: true,
  DateTimeFilter: true,
  // nullable scalar filters
  NullableStringFilter: true,
  NullableIDFilter: true,
  NullableFloatFilter: true,
  NullableIntFilter: true,
  NullableBooleanFilter: true,
  NullableDateTimeFilter: true,
  // photon classes
  PhotonFetcher: true,
  Photon: true,
  Engine: true,
  PhotonOptions: true,
}

const fieldBlacklist = {
  AND: true,
  OR: true,
  NOT: true,
}

/**
 * Checks if a model or field shouldn't be there
 * @param document DMMF.Document
 */
function checkBlacklist(sdl: DMMF.Datamodel) {
  for (const model of sdl.models) {
    if (modelBlacklist[model.name]) {
      throw new Error(`Model name ${model.name} is a reserved name and not allowed in the datamodel`)
    }
    for (const field of model.fields) {
      if (fieldBlacklist[field.name]) {
        throw new Error(`Field ${model.name}.${field.name} is a reserved name and not allowed in the datamodel`)
      }
    }
  }
}

export async function getDMMF(datamodel: string): Promise<DMMF.Document> {
  const engine = new NodeEngine({
    datamodel,
    prismaPath: path.join(__dirname, '../../runtime/prisma'),
  })

  await engine.start()
  const externalDmmf: ExternalDMMF.Document = await engine.getDmmf()
  const dmmf = transformDmmf(externalToInternalDmmf(externalDmmf))
  checkBlacklist(dmmf.datamodel)

  await engine.stop()
  return dmmf
}
