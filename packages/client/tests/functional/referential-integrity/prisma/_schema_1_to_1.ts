export function schema_1to1(id, provider, referentialActionLine) {
  return /* Prisma */ `
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
`
}
