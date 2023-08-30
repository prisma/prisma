import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import { idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  return /* Prisma */ `
${schemaHeader}

enum Enum {
  A
}

model Resource {
  id        ${idForProvider(provider)}
  enumValue Enum?
  ${provider !== 'mysql' ? `enumArray Enum[]` : ''}
}
`
})
