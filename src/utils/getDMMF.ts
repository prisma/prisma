import { DMMF as DMMFComponent } from '@prisma/dmmf'
import { generateCRUDSchema } from 'prisma-generate-schema'
import { DatabaseType } from 'prisma-datamodel'
import { DMMF } from '../runtime/dmmf-types'

export function getDMMF(datamodel: string): DMMF.Document {
  const schema = generateCRUDSchema(datamodel, DatabaseType.postgres)
  return JSON.parse(JSON.stringify(new DMMFComponent(datamodel, schema)))
}
