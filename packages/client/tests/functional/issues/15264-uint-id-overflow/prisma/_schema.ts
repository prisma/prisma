import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  return /* Prisma */ `
${schemaHeader}
    
model Resource {
  id Int @db.UnsignedInt @id
}
`
})
