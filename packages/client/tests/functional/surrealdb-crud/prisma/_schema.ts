import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
      output   = "../generated/prisma/client"
    }

    datasource db {
      provider = "${provider}"
    }

    model User {
      id    String @id @default(cuid())
      email String @unique
      name  String?
      age   Int?
      posts Post[]
    }

    model Post {
      id        String   @id @default(cuid())
      title     String
      content   String?
      published Boolean  @default(false)
      authorId  String
      author    User     @relation(fields: [authorId], references: [id])
    }
  `
})
