import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  const schemaHeader = /* Prisma */ `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URI_${provider}")
}
`

  const schema = /* Prisma */ `
${schemaHeader}
  
model Category {
  id ${idForProvider(provider)}
  name   String  @unique
  brands Brand[]
}

model Brand {
  id ${idForProvider(provider)}
  name       String     @unique
  categories Category[] 
}


model User {
  uid ${idForProvider(provider)}

  upVotedComments   Comment[] @relation("upVotes")
  downVotedComments Comment[] @relation("downVotes")
}

model Comment {
  id ${idForProvider(provider)}

  upVotedUsers   User[] @relation("upVotes")
  downVotedUsers User[] @relation("downVotes")
}

model One {
  id    Int @id
  two   Two @relation(fields: [twoId], references: [id])
  twoId Int @unique
}

model Two {
  id      Int   @id
  one     One?
  three   Three? @relation(fields: [threeId], references: [id])
  threeId Int?  @unique
}

model Three {
  id     Int  @id
  Two    Two?
  four   Four @relation(fields: [fourId], references: [id])
  fourId Int  @unique
}

model Four {
  id    Int    @id
  three Three?
}

    `
  return schema
})
