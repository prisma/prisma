import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import { foreignKeyForProvider, idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  return /* Prisma */ `
${schemaHeader}
  
model User {
  id ${idForProvider(provider)}
  email String
  profile Profile?
}

model Profile {
  id ${idForProvider(provider)}
  userId ${foreignKeyForProvider(provider)} @unique
  user User @relation(fields: [userId], references: [id])
}
`
})
