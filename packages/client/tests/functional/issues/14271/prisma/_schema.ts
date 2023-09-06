import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import { computeReferentialActionLine } from '../../../_utils/relationMode/computeReferentialActionLine'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor, referentialActions }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })
  const { referentialActionLine } = computeReferentialActionLine({ ...referentialActions })

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
