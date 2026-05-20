import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
    }

    datasource db {
      provider = "${provider}"
    }

    model Document {
      id        Int     @id @default(autoincrement())
      content   Json
      metadata  Json?
    }
  `
})
