import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import { foreignKeyForProvider, idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor, conflictingModel }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  return /* Prisma */ `
${schemaHeader}
  
  model Model {
    id ${idForProvider(provider)}
    otherId ${foreignKeyForProvider(provider)} @unique
    other ${conflictingModel} @relation(fields: [otherId], references: [id])
  }

  model ${conflictingModel} {
    id ${idForProvider(provider)}
    name String
    model Model?
  }
  `
})
