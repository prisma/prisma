import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
  }
  
  datasource db {
    provider     = "${provider}"
    url          = env("DATABASE_URI_${provider}")
  }

  model User {
    id        Int     @id @default(autoincrement())
    posts     Post[]
  }

  model Post {
    id       Int   @id @default(autoincrement())
    user     User? @relation(fields: [userId], references: [id])
    userId   Int?

    @@index([userId])
  }
  `
})
