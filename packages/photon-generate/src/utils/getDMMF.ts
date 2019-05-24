import { DMMF as DMMFComponent } from '@prisma/dmmf'
import { DatabaseType, DefaultParser, ISDL } from 'prisma-datamodel'
import { generateCRUDSchemaFromInternalISDL } from 'prisma-generate-schema'
import { DMMF } from '../runtime/dmmf-types'
import { getUnionDocument } from '../runtime/getUnionDocument'
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
function checkBlacklist(sdl: ISDL) {
  for (const model of sdl.types) {
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

export function getDMMF(datamodel: string): DMMF.Document {
  const parser = DefaultParser.create(DatabaseType.postgres)
  const sdl = parser.parseFromSchemaString(datamodel)
  checkBlacklist(sdl)
  const schema = generateCRUDSchemaFromInternalISDL(sdl, DatabaseType.postgres)
  const dmmf: DMMF.Document<DMMF.RawSchemaArg> = JSON.parse(JSON.stringify(new DMMFComponent(datamodel, schema)))
  return transformDmmf(getUnionDocument(dmmf))
}
