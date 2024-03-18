export function schema_1to1(defaultUserId = 3) {
  const schema = /* prisma */ `
    model UserOneToOne {
      id      Int              @id
      profile ProfileOneToOne?
    }

    model ProfileOneToOne {
      id     Int           @id
      user   UserOneToOne? @relation(fields: [userId], references: [id], onUpdate: SetDefault, onDelete: SetDefault)
      userId Int?          @default(${defaultUserId}) @unique
    }
  `

  return schema
}
