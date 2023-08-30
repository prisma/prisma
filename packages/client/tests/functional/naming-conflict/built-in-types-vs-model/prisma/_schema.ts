import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import { foreignKeyForProvider, idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor, typeName }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  return /* Prisma */ `
${schemaHeader}
  
model ${typeName} {
  id ${idForProvider(provider)}
  isUserProvidedType Boolean
  holder RelationHolder?
}

model RelationHolder {
  id ${idForProvider(provider)}
  modelId ${foreignKeyForProvider(provider)} @unique
  model ${typeName} @relation(fields: [modelId], references: [id])
}
`
})
