import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
      output   = "../generated/prisma/client"
    }

    datasource db {
      provider = "${provider}"
    }

    model TypeTest {
      id        String   @id @default(cuid())
      boolVal   Boolean
      intVal    Int
      bigIntVal BigInt
      floatVal  Float
      strVal    String
      dateVal   DateTime
      jsonVal   Json
      bytesVal  Bytes?
    }

    model UniqueTest {
      id    String @id @default(cuid())
      code  String @unique
      value Int
    }

    model CompoundId {
      tenantId String
      itemId   String
      data     String
      @@id([tenantId, itemId])
    }
  `
})
