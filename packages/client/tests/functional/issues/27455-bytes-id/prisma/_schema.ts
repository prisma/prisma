import { Providers } from '../../../_utils/providers'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
      generator client {
        provider = "prisma-client-js"
        previewFeatures = ["driverAdapters"]
      }

      datasource db {
        provider = "${provider}"
        url      = env("DATABASE_URI_${provider}")
      }

      model Accommodation {
        id         Bytes @id${provider === Providers.MYSQL ? ' @db.VarBinary(16)' : ''}
        name       String
        timeTables AccommodationTimeTable[]
      }

      model AccommodationTimeTable {
        id              Bytes @id${provider === Providers.MYSQL ? ' @db.VarBinary(16)' : ''}
        accommodationId Bytes${provider === Providers.MYSQL ? ' @db.VarBinary(16)' : ''}
        accommodation   Accommodation @relation(fields: [accommodationId], references: [id])
      }
      `
})
