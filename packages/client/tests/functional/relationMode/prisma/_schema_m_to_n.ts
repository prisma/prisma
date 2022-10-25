import { Providers } from '../../_utils/providers'
import { ReferentialActionLineOutput } from '../../_utils/relationMode/computeReferentialActionLine'

export function schema_mton(id, provider, referentialActionLineOutput: ReferentialActionLineOutput) {
  const { supportsRequired, referentialActionLine } = referentialActionLineOutput

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
  post       PostManyToMany     @relation(fields: [postId], references: [id] ${
    supportsRequired ? referentialActionLine : ''
  })
  postId     String
  category   CategoryManyToMany @relation(fields: [categoryId], references: [id] ${
    supportsRequired ? referentialActionLine : ''
  })
  categoryId String

  @@id([postId, categoryId])
}
`

  // Note: Referential actions on two-way embedded many-to-many relations are not supported
  // (= adding referential actions is a schema validation error)
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
//
// m:n relation
//
${provider === Providers.MONGODB ? manyToManyMongoDB : manyToManySQLExplicit}
`
}

// const manyToManySQLImplicit = /* Prisma */ `
// model PostManyToMany {
//   id         String        @id
//   categories CategoryManyToMany[]
//   published   Boolean?
// }

// model CategoryManyToMany {
//   id    String    @id
//   posts PostManyToMany[]
//   published   Boolean?
// }
// `
