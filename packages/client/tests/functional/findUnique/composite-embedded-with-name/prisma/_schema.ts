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
        address    String
      }
      
      model A {
        id         String @id @map("_id")
        name       String
        location   Location

        @@unique([name, location.address], name: "name_address")
      }
  `
})
