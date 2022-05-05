export default ({ provider, previewFeatures }) => {
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
    previewFeatures = [${previewFeatures}]
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
}
