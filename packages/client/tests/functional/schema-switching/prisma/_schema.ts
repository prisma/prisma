import { idForProvider } from '../../_utils/idForProvider'
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
  id ${idForProvider(provider)}
  email    String   @unique
  name     String?
  posts    Post[]
  profile  Profile?

  @@schema("schema1")
}

model Post {
  id ${idForProvider(provider)}
  title     String
  content   String?
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])

  @@schema("schema1")
}

model Profile {
  id ${idForProvider(provider)}
  bio      String?
  userId   String   @unique
  user     User     @relation(fields: [userId], references: [id])

  @@schema("schema1")
}

// Same models in schema2 for testing
model Organization {
  id ${idForProvider(provider)}
  name     String   @unique
  members  Member[]

  @@schema("schema2")
}

model Member {
  id ${idForProvider(provider)}
  email    String
  role     String
  orgId    String
  org      Organization @relation(fields: [orgId], references: [id])

  @@schema("schema2")
}
  `
})
