import { Providers } from '../../_utils/providers'

export function schema_1ton({ id, provider, referentialActionLine, isSchemaUsingMap }) {
  if (isSchemaUsingMap) {
    return /* Prisma */ `
//
// 1:n relation
//
model UserOneToMany {
  id    ${id} ${provider !== Providers.MONGODB ? `@map("idAtMap")` : ''}
  posts PostOneToMany[]
  enabled Boolean?        @map("enabledAtMap")

  @@map("UserOneToManyAtAtMap")
}
model PostOneToMany {
  id        ${id} ${provider !== Providers.MONGODB ? `@map("idAtMap")` : ''}
  author    UserOneToMany @relation(fields: [authorId], references: [id] ${referentialActionLine})
  authorId  String        @map("authorIdAtMap")

  @@map("PostOneToManyAtAtMap")
}
`
  } else {
    return /* Prisma */ `
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
  author    UserOneToMany @relation(fields: [authorId], references: [id] ${referentialActionLine})
  authorId  String
}
`
  }
}
