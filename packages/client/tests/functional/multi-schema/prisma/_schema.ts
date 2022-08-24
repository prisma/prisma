import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
      previewFeatures = ["multiSchema"]
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI_${provider}")
      schemas  = ["base", "transactional"]
    }
    
    model User {
      id ${idForProvider(provider)}
      email String
      posts Post[]

      @@schema("base")
    }

    model Post {
      id ${idForProvider(provider)}
      title     String
      authorId  String
      author    User?    @relation(fields: [authorId], references: [id])

      @@schema("transactional")
    }
  `
})
