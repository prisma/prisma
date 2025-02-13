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
      
      model Visit {
        id        Int      @id @default(autoincrement())
        visitTime DateTime @default(now())
      }
      `
})
