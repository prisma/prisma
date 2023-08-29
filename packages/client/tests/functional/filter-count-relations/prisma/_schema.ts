import { computeSchemaHeader } from '../../_utils/computeSchemaHeader'
import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }) => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  let foreignKeyType
  let manyToManyGroup
  let manyToManyUser

  if (provider === 'mongodb') {
    foreignKeyType = 'String @db.ObjectId'
    manyToManyGroup = `
      userIds String[] @db.ObjectId
      users User[] @relation(fields: [userIds], references: [id])
    `
    manyToManyUser = `
      groupIds String[] @db.ObjectId
      groups Group[] @relation(fields: [groupIds], references: [id])
    `
  } else {
    foreignKeyType = 'String'
    manyToManyGroup = 'users User[]'
    manyToManyUser = 'groups Group[]'
  }

  return /* Prisma */ `
${schemaHeader}
  
model User {
  id ${idForProvider(provider)}
  email String
  blocked Boolean @default(false)
  balance Int
  posts Post[]
  ${manyToManyUser}
}

model Group {
  id ${idForProvider(provider)}
  title String
  ${manyToManyGroup}
}

model Post {
  id ${idForProvider(provider)}
  published Boolean
  upvotes Int
  authorId ${foreignKeyType}
  author User @relation(fields: [authorId], references: [id])
}
`
})
