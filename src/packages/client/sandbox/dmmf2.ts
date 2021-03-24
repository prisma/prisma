import { getDMMF } from '@prisma/sdk'
import { externalToInternalDmmf } from '../src/runtime/externalToInternalDmmf'

const datamodel = `generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["groupBy"]
  binaryTargets   = ["native"]
}

datasource db {
  provider = "sqlite"
  url      = env("DB_URL")
}

model Organization {
  id       String    @id @default(uuid())
  fullName String
  operator Operator?
  accounts Account[]
}

model Operator {
  id             String       @id @default(uuid())
  prefix         String       @unique
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  accounts       Account[]
}

model Account {
  id             String       @id @default(uuid())
  operatorId     String
  organizationId String
  operator       Operator     @relation(fields: [operatorId], references: [id])
  organization   Organization @relation(fields: [organizationId], references: [id])
}`

async function main() {
  let dmmf = await getDMMF({ datamodel })
  dmmf = externalToInternalDmmf(dmmf)
  const type = dmmf.schema.inputObjectTypes.prisma.find(
    (t) => t.name === 'OperatorCreateNestedOneWithoutAccountsInput',
  )
  console.dir(type, { depth: 4 })
}

main()
