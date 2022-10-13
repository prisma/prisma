import { Providers } from '../../_utils/providers'

export function schema_mton({ id, provider, referentialActionLine, isSchemaUsingMap }) {
  let manyToManySQLExplicit
  let manyToManyMongoDB

  if (isSchemaUsingMap) {
    manyToManySQLExplicit = /* Prisma */ `
model PostManyToMany {
  id         ${id}
  categories CategoriesOnPostsManyToMany[]
  published   Boolean?          @map("publishedAtMap")

  @@map("PostManyToManyAtAtMap")
}

model CategoryManyToMany {
  id    ${id}                   @map("idAtMap")
  posts CategoriesOnPostsManyToMany[]
  published   Boolean?          @map("publishedAtMap")

  @@map("CategoryManyToManyAtAtMap")
}

model CategoriesOnPostsManyToMany {
  post       PostManyToMany     @relation(fields: [postId], references: [id] ${referentialActionLine})
  postId     String             @map("postIdAtMap")
  category   CategoryManyToMany @relation(fields: [categoryId], references: [id] ${referentialActionLine})
  categoryId String             @map("categoryIdAtMap")

  @@id([postId, categoryId])
  @@map("CategoriesOnPostsManyToManyAtAtMap")
}
  `

    // Note: Referential actions on two-way embedded many-to-many relations are not supported
    // (= adding referential actions is a schema validation error)
    manyToManyMongoDB = /* Prisma */ `
model PostManyToMany {
  id          String               @id @map("_id")
  categoryIDs String[]             @map("categoryIDsAtMap")
  categories  CategoryManyToMany[] @relation(fields: [categoryIDs], references: [id])
  published   Boolean?             @map("publishedAtMap")

  @@map("PostManyToManyAtAtMap")
}

model CategoryManyToMany {
  id      String             @id @map("_id") 
  postIDs String[]           @map("postIDsAtMap")
  posts   PostManyToMany[]   @relation(fields: [postIDs], references: [id])
  published   Boolean?       @map("publishedAtMap")

  @@map("CategoryManyToManyAtAtMap")
}
  `
  } else {
    manyToManySQLExplicit = /* Prisma */ `
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
  post       PostManyToMany     @relation(fields: [postId], references: [id] ${referentialActionLine})
  postId     String
  category   CategoryManyToMany @relation(fields: [categoryId], references: [id] ${referentialActionLine})
  categoryId String

  @@id([postId, categoryId])
}
    `

    // Note: Referential actions on two-way embedded many-to-many relations are not supported
    // (= adding referential actions is a schema validation error)
    manyToManyMongoDB = /* Prisma */ `
model PostManyToMany {
  id          String               @id @map("_id")
  categoryIDs String[]
  categories  CategoryManyToMany[] @relation(fields: [categoryIDs], references: [id])
  published   Boolean?
}

model CategoryManyToMany {
  id      String                  @id @map("_id") 
  postIDs String[]
  posts   PostManyToMany[]        @relation(fields: [postIDs], references: [id])
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
