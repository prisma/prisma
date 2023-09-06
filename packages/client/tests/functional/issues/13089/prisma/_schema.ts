import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
  })

  return /* Prisma */ `
${schemaHeader}

model users {
  id        String @id @map("_id") @default(auto()) @db.ObjectId
  firstName String @unique
}
`
})
