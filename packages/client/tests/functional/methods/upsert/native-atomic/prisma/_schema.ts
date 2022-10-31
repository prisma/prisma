import { idForProvider } from '../../../../_utils/idForProvider'
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
    
    model User {
      id             ${idForProvider(provider)}
      name           String @unique
      posts          Post[]
    }

    model Post {
      id              ${idForProvider(provider)}
      title           String @unique
      author          User?     @relation(fields: [authorId], references: [id])
      authorId        String
    }
  `
})
