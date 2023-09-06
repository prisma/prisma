import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import { idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
    previewFeatures: 'metrics',
  })

  return /* Prisma */ `
${schemaHeader}
  
model User {
  id    ${idForProvider(provider)}
  email String
}
`
})
