import { idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
      generator client {
        provider = "prisma-client-js"
        previewFeatures = ["typedSql"]
      }
      
      datasource db {
        provider = "${provider}"
        url      = env("DATABASE_URI_${provider}")
      }
      
      model TestModel {
        id ${idForProvider(provider)}
        string String?
        int Int?
        bytes Bytes?
        double Float?
        bool Boolean?
        bigInt BigInt?
        decimal Decimal?
        dateTime DateTime?
      }
      `
})
