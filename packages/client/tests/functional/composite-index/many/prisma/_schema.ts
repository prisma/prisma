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
      
      type Location {
        address String
      }

      type Person {
        name String
        age Int
      }
      
      model A {
        id         String @id @map("_id")
        person     Person
        location   Location

        @@unique([location.address, person.name])
      }
  `
})
