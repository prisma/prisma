import { idForProvider } from '../../_utils/idForProvider'

export default ({ provider }) => {
  const id = idForProvider(provider)

  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
    previewFeatures = ["interactiveTransactions"]
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }
  
  model User {
    id ${id}
    email String
    posts Post[]
  }

  model Post {
    id ${id}
    title String
    author User @relation(fields: [authorId], references: [id])
    authorId String
  }
  `
}
