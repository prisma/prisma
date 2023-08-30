import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor, relationMode }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
    relationMode,
  })

  return /* Prisma */ `
${schemaHeader}
    
model Item {
  id         Int        @id @default(autoincrement())
  categories Category[]
  createdAt  DateTime   @default(now())
  updatedAt  DateTime?  @updatedAt
}

model Category {
  id        Int       @id @default(autoincrement())
  items     Item[]
  createdAt DateTime  @default(now())
  updatedAt DateTime? @updatedAt
}
`
})
