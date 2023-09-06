import { computeSchemaHeader } from '../../_utils/computeSchemaHeader'
import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })
  const id = idForProvider(provider)

  return /* Prisma */ `
${schemaHeader}

model User {
  id    ${id}
  email String  @unique
  name  String?
  posts Post[]
  val   Int?
}

model Post {
  id        ${id}
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  published Boolean
  title     String
  content   String?
  authorId  String?
  author    User?    @relation(fields: [authorId], references: [id])
}
`
})
