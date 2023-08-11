import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI_${provider}")
    }
    
    model TestModel {
      id     Int       @id
      string String?
      int    Int?
      bInt   BigInt?
      float  Float?
      bytes  Bytes?
      bool   Boolean?
      dt     DateTime?
      dec    Decimal?
    }
  `
})
