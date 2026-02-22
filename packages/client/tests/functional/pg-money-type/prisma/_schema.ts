import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
  }

  datasource db {
    provider = "${provider}"
    url      = env("TEST_POSTGRES_URI")
  }

  model Order {
    id        Int      @id @default(autoincrement())
    price     Decimal  @db.Money
    createdAt DateTime @default(now())
  }
  `
})
