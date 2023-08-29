import { computeSchemaHeader } from '../../_utils/computeSchemaHeader'
import { Providers } from '../../_utils/providers'
import { ProviderFlavor } from '../../_utils/relationMode/ProviderFlavor'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor, relationMode, id }): string => {
  const schemaHeader = computeSchemaHeader({
    provider: provider as Providers,
    providerFlavor: providerFlavor as ProviderFlavor,
    relationMode,
  })

  return /* Prisma */ `
${schemaHeader}
    
    model User {
      id ${id}
    }
  `
})
