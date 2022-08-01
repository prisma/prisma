import { computeReferentialActionLine } from '../../_referential-integrity-utils/computeReferentialActionLine'
import { computeSchemaHeader } from '../../_referential-integrity-utils/computeSchemaHeader'
import { Providers } from '../../_utils/providers'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, previewFeatures, referentialIntegrity, referentialActions, id }) => {
  const schemaHeader = computeSchemaHeader({ provider, previewFeatures, referentialIntegrity })
  const referentialActionLine = computeReferentialActionLine({ referentialActions })

  const manyToManySQLExplicit = /* Prisma */ `
model PostManyToMany {
  id         ${id}
  categories CategoriesOnPostsManyToMany[]
  published   Boolean?
}

model CategoryManyToMany {
  id    ${id}
  posts CategoriesOnPostsManyToMany[]
  published   Boolean?
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
  published   Boolean?
}

model CategoryManyToMany {
  id    String    @id 
  posts PostManyToMany[]
  published   Boolean?
}
`

  const manyToManyMongoDB = /* Prisma */ `
model PostManyToMany {
  id          String     @id @map("_id")
  categoryIDs String[]
  categories  CategoryManyToMany[] @relation(fields: [categoryIDs], references: [id])
  published   Boolean?
}

model CategoryManyToMany {
  id      String   @id @map("_id") 
  postIDs String[]
  posts   PostManyToMany[]   @relation(fields: [postIDs], references: [id])
  published   Boolean?
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
  enabled Boolean?
}
model ProfileOneToOne {
  id       ${id}
  user     UserOneToOne @relation(fields: [userId], references: [id]${referentialActionLine})
  userId   String @unique
  enabled Boolean?
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
