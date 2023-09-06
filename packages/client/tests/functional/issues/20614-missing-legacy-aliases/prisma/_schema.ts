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
  
model Group {
  id    ${idForProvider(provider)}
  users User[]
}

model User {
  id      ${idForProvider(provider)}
  name    String
  group   Group  @relation(fields: [groupId], references: [id])
  groupId ${foreignKeyForProvider(provider)}
}
`
})
