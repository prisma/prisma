import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  return /* Prisma */ `
${schemaHeader}
  
model Component {
  id         BigInt              @id @default(autoincrement()) @db.BigInt
  title      String
  categories ComponentCategory[]
}

model ComponentCategory {
  id         BigInt      @id @default(autoincrement()) @db.BigInt
  name       String
  components Component[]
}
`
})
