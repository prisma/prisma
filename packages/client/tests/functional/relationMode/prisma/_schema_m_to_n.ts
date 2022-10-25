import { Providers } from '../../_utils/providers'
import { ReferentialActionLineOutput } from '../../_utils/relationMode/computeReferentialActionLine'

export function schema_mton({
  id,
  provider,
  referentialActionLineOutput,
  isSchemaUsingMap,
}: {
  id: string
  provider: Providers
  referentialActionLineOutput: ReferentialActionLineOutput
  isSchemaUsingMap: boolean
}) {
  const { supportsRequired, referentialActionLine } = referentialActionLineOutput
  let manyToManySQLExplicit
  let manyToManyMongoDB

  if (isSchemaUsingMap) {
    manyToManySQLExplicit = /* Prisma */ `
model PostManyToMany {
  id          ${id}
  categories  CategoriesOnPostsManyToMany[]
  published   Boolean?              @map("published_AtMap")

  @@map("PostManyToMany_AtAtMap")
}

model CategoryManyToMany {
  id          ${id}                 @map("id_AtMap")
  posts       CategoriesOnPostsManyToMany[]
  published   Boolean?              @map("published_AtMap")

  @@map("CategoryManyToMany_AtAtMap")
}

model CategoriesOnPostsManyToMany {
  post        PostManyToMany        @relation(fields: [postId], references: [id] ${
    supportsRequired ? referentialActionLine : ''
  })
  postId      String                @map("postId_AtMap")
  category    CategoryManyToMany    @relation(fields: [categoryId], references: [id] ${
    supportsRequired ? referentialActionLine : ''
  })
  categoryId  String                @map("categoryId_AtMap")

  @@id([postId, categoryId])
  @@map("CategoriesOnPostsManyToMany_AtAtMap")
}
  `

    // Note: Referential actions on two-way embedded many-to-many relations are not supported
    // (= adding referential actions is a schema validation error)
    manyToManyMongoDB = /* Prisma */ `
model PostManyToMany {
  id          String                @id @map("_id")
  categoryIDs String[]              @map("categoryIDs_AtMap")
  categories  CategoryManyToMany[]  @relation(fields: [categoryIDs], references: [id])
  published   Boolean?              @map("published_AtMap")

  @@map("PostManyToMany_AtAtMap")
}

model CategoryManyToMany {
  id          String                @id @map("_id") 
  postIDs     String[]              @map("postIDs_AtMap")
  posts       PostManyToMany[]      @relation(fields: [postIDs], references: [id])
  published   Boolean?              @map("published_AtMap")

  @@map("CategoryManyToMany_AtAtMap")
}
  `
  } else {
    manyToManySQLExplicit = /* Prisma */ `
model PostManyToMany {
  id          ${id}
  categories  CategoriesOnPostsManyToMany[]
  published   Boolean?
}

model CategoryManyToMany {
  id          ${id}
  posts       CategoriesOnPostsManyToMany[]
  published   Boolean?
}

model CategoriesOnPostsManyToMany {
  post        PostManyToMany        @relation(fields: [postId], references: [id] ${
    supportsRequired ? referentialActionLine : ''
  })
  postId      String
  category    CategoryManyToMany    @relation(fields: [categoryId], references: [id] ${
    supportsRequired ? referentialActionLine : ''
  })
  categoryId  String

  @@id([postId, categoryId])
}
    `

    // Note: Referential actions on two-way embedded many-to-many relations are not supported
    // (= adding referential actions is a schema validation error)
    manyToManyMongoDB = /* Prisma */ `
model PostManyToMany {
  id          String                @id @map("_id")
  categoryIDs String[]
  categories  CategoryManyToMany[]  @relation(fields: [categoryIDs], references: [id])
  published   Boolean?
}

model CategoryManyToMany {
  id          String                @id @map("_id") 
  postIDs     String[]
  posts       PostManyToMany[]      @relation(fields: [postIDs], references: [id])
  published   Boolean?
}
    `
  }

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
