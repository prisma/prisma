import { Providers } from '../../_utils/providers'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, previewFeatures, referentialIntegrity, referentialActions, id }) => {
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
  if (referentialActions.onUpdate && referentialActions.onUpdate !== 'DEFAULT') {
    referentialActionLine += `, onUpdate: ${referentialActions.onUpdate}`
  }
  if (referentialActions.onDelete && referentialActions.onDelete !== 'DEFAULT') {
    referentialActionLine += `, onDelete: ${referentialActions.onDelete}`
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
