import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  return /* Prisma */ `
${schemaHeader}

model Category {
  id     String  @id @default(cuid())
  name   String  @unique
  brands Brand[]
}

model Brand {
  id         String     @id @default(cuid())
  name       String     @unique
  categories Category[] 
}
`
})
