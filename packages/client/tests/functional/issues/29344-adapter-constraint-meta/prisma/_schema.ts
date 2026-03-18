import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
    }

    datasource db {
      provider = "${provider}"
    }

    model User {
      id    Int    @id @default(autoincrement())
      email String @unique
      posts Post[]
    }

    model Post {
      id       Int  @id @default(autoincrement())
      authorId Int
      author   User @relation(fields: [authorId], references: [id])
    }
  `
})
