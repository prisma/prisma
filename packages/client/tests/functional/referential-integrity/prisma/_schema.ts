import { Providers } from '../../_utils/providers'
import testMatrix from '../_matrix'

const PLANETSCALE = false
// const PLANETSCALE = true

export default testMatrix.setupSchema(({ provider, previewFeatures, referentialIntegrity, referentialActions, id }) => {
  // if referentialIntegrity is not defined, we do not add the line
  // if referentialIntegrity is defined
  // we add the line only if the provider is not MongoDB, since MongoDB doesn't need the setting, it's on by default
  const referentialIntegrityLine =
    provider === Providers.MONGODB || !referentialIntegrity ? '' : `referentialIntegrity = "${referentialIntegrity}"`

  const schemaHeader = /* Prisma */ `
generator client {
  provider = "prisma-client-js"
  previewFeatures = [${previewFeatures}]
}

datasource db {
  provider = "${provider}"
  ${
    PLANETSCALE && provider === Providers.MYSQL
      ? `url = "mysql://root:root@127.0.0.1:33807/PRISMA_DB_NAME"`
      : `url = env("DATABASE_URI_${provider}")`
  }
  ${referentialIntegrityLine}
}
  `

  let referentialActionLine = ''
  if (referentialActions.onUpdate && referentialActions.onUpdate !== 'DEFAULT') {
    referentialActionLine += `, onUpdate: ${referentialActions.onUpdate}`
  }
  if (referentialActions.onDelete && referentialActions.onDelete !== 'DEFAULT') {
    referentialActionLine += `, onDelete: ${referentialActions.onDelete}`
  }

  const manyToManySQLExplicit = /* Prisma */ `
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

  @@id([postId, categoryId])
}
`

  const manyToManySQLImplicit = /* Prisma */ `
model PostManyToMany {
  id         String        @id 
  categories CategoryManyToMany[]
}

model CategoryManyToMany {
  id    String    @id 
  posts PostManyToMany[]
}
`

  const manyToManyMongoDB = /* Prisma */ `
model PostManyToMany {
  id          String     @id @map("_id")
  categoryIDs String[]
  categories  CategoryManyToMany[] @relation(fields: [categoryIDs], references: [id])
}

model CategoryManyToMany {
  id      String   @id @map("_id") 
  postIDs String[]
  posts   PostManyToMany[]   @relation(fields: [postIDs], references: [id])
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
  enabled Boolean?
}
model PostOneToMany {
  id        ${id}
  author    UserOneToMany @relation(fields: [authorId], references: [id]${referentialActionLine})
  authorId  String
}

//
// m:n relation
//
${provider === Providers.MONGODB ? manyToManyMongoDB : manyToManySQLExplicit}
  `
})
