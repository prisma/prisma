import { Providers } from '../../_utils/providers'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, previewFeatures, referentialIntegrity, referentialActions, id }) => {
  let referentialIntegrityLine = ''
  switch (referentialIntegrity) {
    case 'prisma':
    case 'foreignKeys':
      referentialIntegrityLine = `referentialIntegrity = "${referentialIntegrity}"`
      break
    default:
      break
  }

  const schemaHeader = /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
      previewFeatures = [${previewFeatures}]
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI_${provider}")
      ${referentialIntegrityLine}
    }
  `

  let referentialActionLine = ''
  if (referentialActions.onUpdate) {
    referentialActionLine += `, onUpdate: ${referentialActions.onUpdate}`
  }
  if (referentialActions.onDelete) {
    referentialActionLine += `, onDelete: ${referentialActions.onDelete}`
  }

  const manyToMany = /* Prisma */ `
//
// m:n relation
//

model PostManyToMany {
  id         ${id}
  categories CategoriesOnPostsManyToMany[]
}

model CategoryManyToMany {
  id    ${id}
  posts CategoriesOnPostsManyToMany[]
}

model CategoriesOnPostsManyToMany {
  post       PostManyToMany     @relation(fields: [postId], references: [id]${referentialActionLine})
  postId     String
  category   CategoryManyToMany @relation(fields: [categoryId], references: [id]${referentialActionLine})
  categoryId String

  // Not supported on MongoDB
  @@id([postId, categoryId])
}
`

  return /* Prisma */ `
${schemaHeader}

//
// 1:1 relation
//

model UserOneToOne {
  id      ${id}
  profile ProfileOneToOne?
}
model ProfileOneToOne {
  id       ${id}
  user     UserOneToOne @relation(fields: [userId], references: [id]${referentialActionLine})
  userId   String @unique
}

//
// 1:n relation
//

model UserOneToMany {
  id    ${id}
  posts PostOneToMany[]
}
model PostOneToMany {
  id       ${id}
  author   UserOneToMany @relation(fields: [authorId], references: [id]${referentialActionLine})
  authorId String
}

${provider === Providers.MONGODB ? '' : manyToMany}
  `
})
