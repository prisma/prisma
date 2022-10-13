import { Providers } from '../../_utils/providers'

export function schema_1to1({ id, provider, referentialActionLine, isSchemaUsingMap }) {
  if (isSchemaUsingMap) {
    return /* Prisma */ `
//
// 1:1 relation with @map/@@map
//
model UserOneToOne {
  id      ${id} ${provider !== Providers.MONGODB ? `@map("idAtMap")` : ''}
  profile ProfileOneToOne? 
  enabled Boolean?            @map("enabledAtMap")

  @@map("UserOneToOneAtAtMap")
}

model ProfileOneToOne {
  id       ${id} ${provider !== Providers.MONGODB ? `@map("idAtMap")` : ''}
  user     UserOneToOne       @relation(fields: [userId], references: [id] ${referentialActionLine}) 
  userId   String @unique     @map("userIdAtMap")
  enabled  Boolean?           @map("enabledAtMap")

  @@map("ProfileOneToOneAtAtMap")
}
`
  } else {
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
  user     UserOneToOne   @relation(fields: [userId], references: [id] ${referentialActionLine}) 
  userId   String         @unique
  enabled  Boolean? 
}
`
  }
}
