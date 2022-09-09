import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, mapTable }) => {
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
      ${mapTable ? '@@map("some_table-1")' : ''}
    }

    model Post {
      id ${idForProvider(provider)}
      title     String
      authorId  String
      author    User?    @relation(fields: [authorId], references: [id])

      @@schema("transactional")
      ${mapTable ? '@@map("some_table-2")' : ''}
    }
  `
})
