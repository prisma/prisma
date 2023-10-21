import { ConnectorType } from '@prisma/generator-helper'

import { defaultSchema } from '../Init'

const defaultAttributes = `email String  @unique
  name  String?`

export const getDefaultSchemaModel = (provider: ConnectorType) => {
  return defaultSchema(provider).concat(`
model User {
  id    Int     @id @default(autoincrement())
  ${defaultAttributes}
}
`)
}

export const getSchemaModelMongoDb = (provider: ConnectorType) => {
  return defaultSchema(provider).concat(`
model User {
  id    String   @id @default(auto()) @map("_id") @db.ObjectId
  ${defaultAttributes}
}
`)
}

export const getSchemaModelCockroachDb = (provider: ConnectorType) => {
  return defaultSchema(provider).concat(`
model User {
  id    BigInt  @id @default(sequence())
  ${defaultAttributes}
}
`)
}
