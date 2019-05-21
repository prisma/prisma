import { DMMF as DMMFComponent } from '@prisma/dmmf'
import { generateCRUDSchema } from 'prisma-generate-schema'
import { DatabaseType } from 'prisma-datamodel'
import { DMMF } from '../runtime/dmmf-types'
import { getUnionDocument } from '../runtime/getUnionDocument'
import { transformDmmf } from '../runtime/transformDmmf'

export function getDMMF(datamodel: string): DMMF.Document {
  const schema = generateCRUDSchema(datamodel, DatabaseType.postgres)
  const dmmf: DMMF.Document<DMMF.RawSchemaArg> = JSON.parse(JSON.stringify(new DMMFComponent(datamodel, schema)))
  return transformDmmf(getUnionDocument(dmmf))
}
