export function schema_1ton(id, provider, referentialActionLine) {
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
