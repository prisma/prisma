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
        id         Bytes                    @id
        name       String
        timeTables AccommodationTimeTable[]
      }

      model AccommodationTimeTable {
        id              Bytes         @id
        accommodationId Bytes
        accommodation   Accommodation @relation(fields: [accommodationId], references: [id])
      }
      `
})
