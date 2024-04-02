import { idForProvider } from '../../_utils/idForProvider'
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
      id    ${idForProvider(provider)}
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
