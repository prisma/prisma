import { Providers } from '../../_utils/providers'
import { ReferentialActionLineOutput } from '../../_utils/relationMode/computeReferentialActionLine'

export function schema_1ton({
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
// 1:n relation
//
model UserOneToMany {
  id            ${id} ${provider !== Providers.MONGODB ? `@map("id_AtMap")` : ''}
  posts         PostOneToMany[]
  postOptionals PostOptionalOneToMany[]
  enabled       Boolean?        @map("enabledAtMap")

  @@map("UserOneToMany_AtAtMap")
}

model PostOneToMany {
  id            ${id} ${provider !== Providers.MONGODB ? `@map("id_AtMap")` : ''}
  author        UserOneToMany   @relation(fields: [authorId], references: [id] ${
    supportsRequired ? referentialActionLine : ''
  })
  authorId      String          @map("authorId_AtMap")

  @@map("PostOneToMany_AtAtMap")
}

model PostOptionalOneToMany {
  id            ${id}
  author        UserOneToMany?  @relation(fields: [authorId], references: [id] ${referentialActionLine})
  authorId      String?         @map("authorId_AtMap")

  @@map("PostOptionalOneToMany_AtAtMap")
}
`
  } else {
    return /* Prisma */ `
//
// 1:n relation
//
model UserOneToMany {
  id            ${id}
  posts         PostOneToMany[]
  postOptionals PostOptionalOneToMany[]
  enabled       Boolean?
}

model PostOneToMany {
  id            ${id}
  author        UserOneToMany   @relation(fields: [authorId], references: [id] ${
    supportsRequired ? referentialActionLine : ''
  })
  authorId      String
}

model PostOptionalOneToMany {
  id            ${id}
  author        UserOneToMany?  @relation(fields: [authorId], references: [id] ${referentialActionLine})
  authorId      String?
}
`
  }
}
