import { Providers } from '../../_utils/providers'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, previewFeatures, referentialIntegrity, onUpdate, onDelete, id }) => {
  // if referentialIntegrity is not defined, we do not add the line
  // if referentialIntegrity is defined
  // we add the line only if the provider is not MongoDB, since MongoDB doesn't need the setting, it's on by default
  const referentialIntegrityLine = `referentialIntegrity = "${referentialIntegrity}"`

  const schemaHeader = /* Prisma */ `
generator client {
  provider = "prisma-client-js"
  previewFeatures = [${previewFeatures}]
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URI_${provider}")
  ${referentialIntegrityLine}
}
  `

  let referentialActionLine = ''
  if (onUpdate && onUpdate !== 'DEFAULT') {
    referentialActionLine += `, onUpdate: ${onUpdate}`
  }
  if (onDelete && onDelete !== 'DEFAULT') {
    referentialActionLine += `, onDelete: ${onDelete}`
  }

  return /* Prisma */ `
${schemaHeader}

model Hub {
  id                    Int                    @id @default(autoincrement())
  name                  String @unique
  batteryLevels         BatteryLevel[]
}
model BatteryLevel {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  hubId     Int?
  hub       Hub?     @relation(fields: [hubId], references: [id] ${referentialActionLine})
}
  `
})
