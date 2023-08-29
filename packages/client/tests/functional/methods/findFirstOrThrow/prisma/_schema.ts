import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import { idForProvider } from '../../../_utils/idForProvider'
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
  id ${id}
  email String
  posts Post[]
}

model Post {
  id ${id}
  title String
  author User @relation(fields: [authorId], references: [id])
  authorId String
}
`
})
