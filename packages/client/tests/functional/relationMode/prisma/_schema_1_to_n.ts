import { ReferentialActionLineOutput } from '../../_utils/relationMode/computeReferentialActionLine'

export function schema_1ton(id, provider, referentialActionLineOutput: ReferentialActionLineOutput) {
  const { supportsRequired, referentialActionLine } = referentialActionLineOutput

  return /* Prisma */ `
//
// 1:n relation
//
model UserOneToMany {
  id    ${id}
  posts PostOneToMany[]
  postOptionals PostOptionalOneToMany[]
  enabled Boolean?
}
model PostOneToMany {
  id        ${id}
  author    UserOneToMany @relation(fields: [authorId], references: [id] ${
    supportsRequired ? referentialActionLine : ''
  })
  authorId  String
}
model PostOptionalOneToMany {
  id        ${id}
  author    UserOneToMany? @relation(fields: [authorId], references: [id] ${referentialActionLine})
  authorId  String?
}
`
}
