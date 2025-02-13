import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  const id = idForProvider(provider)

  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI_${provider}")
    }
    
    model User {
      id ${id}
      email String  @unique
      name  String?
      posts  Post[]
    }

    model Post {
      id ${id}
      title     String
      content   String?
      published Boolean @default(false)
      author    User?    @relation(fields: [authorId], references: [id])
      authorId  String?
    }
  `
})
