import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import { idForProvider } from '../../../_utils/idForProvider'
import { ProviderFlavor } from '../../../_utils/providerFlavors'
import { Providers } from '../../../_utils/providers'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider: provider as Providers,
    providerFlavor: providerFlavor as ProviderFlavor,
  })

  return /* Prisma */ `
${schemaHeader}
    
model User {
  id ${idForProvider(provider)}
  decimals Decimal[]
}
`
})
