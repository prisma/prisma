export function schema_1ton(defaultUserId = 3) {
  const schema = /* prisma */ `
    model UserOneToMany {
      id    Int             @id
      posts PostOneToMany[]
    }

    model PostOneToMany {
      id     Int            @id
      user   UserOneToMany? @relation(fields: [userId], references: [id], onUpdate: SetDefault, onDelete: SetDefault)
      userId Int?           @default(${defaultUserId})
    }
  `

  return schema
}
