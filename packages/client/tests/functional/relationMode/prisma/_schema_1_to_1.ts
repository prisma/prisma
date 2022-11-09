import { Providers } from '../../_utils/providers'
import { ReferentialActionLineOutput } from '../../_utils/relationMode/computeReferentialActionLine'

export function schema_1to1({
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

  if (isSchemaUsingMap) {
    return /* Prisma */ `
//
// 1:1 relation with @map/@@map
//
model UserOneToOne {
  id              ${id} ${provider !== Providers.MONGODB ? `@map("id_AtMap")` : ''}
  profile         ProfileOneToOne? 
  profileOptional ProfileOptionalOneToOne?
  enabled         Boolean?                       @map("enabled_AtMap")

  @@map("UserOneToOne_AtAtMap")
}

model ProfileOneToOne {
  id              ${id} ${provider !== Providers.MONGODB ? `@map("id_AtMap")` : ''}
  user            UserOneToOne      @relation(fields: [userId], references: [id] ${
    supportsRequired ? referentialActionLine : ''
  })
  userId          String            @unique      @map("userId_AtMap")
  enabled         Boolean?                       @map("enabled_AtMap")

  @@map("ProfileOneToOne_AtAtMap")
}

model ProfileOptionalOneToOne {
  id              ${id}
  user            UserOneToOne?     @relation(fields: [userId], references: [id] ${referentialActionLine})
  userId          String?           @unique     @map("userId_AtMap")
  enabled         Boolean?                      @map("enabled_AtMap") 

  @@map("ProfileOptionalOneToOne_AtAtMap")
}
`
  } else {
    return /* Prisma */ `
//
// 1:1 relation
//
model UserOneToOne {
  id              ${id}
  profile         ProfileOneToOne?
  profileOptional ProfileOptionalOneToOne?
  enabled         Boolean?
}

model ProfileOneToOne {
  id              ${id}
  user            UserOneToOne      @relation(fields: [userId], references: [id] ${
    supportsRequired ? referentialActionLine : ''
  })
  userId          String            @unique
  enabled         Boolean?
}

model ProfileOptionalOneToOne {
  id              ${id}
  user            UserOneToOne?     @relation(fields: [userId], references: [id] ${referentialActionLine})
  userId          String?           @unique
  enabled         Boolean?
}
`
  }
}
