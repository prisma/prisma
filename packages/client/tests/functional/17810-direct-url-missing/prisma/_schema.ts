import { computeSchemaHeader } from '../../_utils/computeSchemaHeader'
import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
    directUrl: `env("DIRECT_DATABASE_URI_${providerFlavor ? providerFlavor : provider}")`,
  })

  return /* Prisma */ `
${schemaHeader}
    
model User {
  id ${idForProvider(provider)}
}
`
})
