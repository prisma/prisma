import { computeSchemaHeader } from '../../_utils/computeSchemaHeader'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor, previewFeatures, index }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
    previewFeatures,
  })

  return /* Prisma */ `
${schemaHeader}
  
model User {
  id    Int @id @default(autoincrement())
  email String @unique
  name  String
  ${index}
}
`
})
