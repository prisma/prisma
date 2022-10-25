import { ReferentialActionLineOutput } from '../../_utils/relationMode/computeReferentialActionLine'

export function schema_1to1(id, provider, referentialActionLineOutput: ReferentialActionLineOutput) {
  const { supportsRequired, referentialActionLine } = referentialActionLineOutput

  return /* Prisma */ `
//
// 1:1 relation
//
model UserOneToOne {
  id      ${id}
  profile ProfileOneToOne?
  profileOptional ProfileOptionalOneToOne?
  enabled Boolean?
}
model ProfileOneToOne {
  id       ${id}
  user     UserOneToOne @relation(fields: [userId], references: [id] ${supportsRequired ? referentialActionLine : ''})
  userId   String @unique
  enabled Boolean?
}
model ProfileOptionalOneToOne {
  id       ${id}
  user     UserOneToOne? @relation(fields: [userId], references: [id] ${referentialActionLine})
  userId   String? @unique
  enabled Boolean?
}
`
}
