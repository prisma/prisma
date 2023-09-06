import { computeSchemaHeader } from '../../_utils/computeSchemaHeader'
import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  return /* Prisma */ `
${schemaHeader}
  
model NullableJsonField {
  id   ${idForProvider(provider)}
  json Json?
}

model RequiredJsonField {
  id   ${idForProvider(provider)}
  json Json
}
`
})
