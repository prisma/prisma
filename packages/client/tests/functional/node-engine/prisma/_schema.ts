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

    `
  return schema
})
