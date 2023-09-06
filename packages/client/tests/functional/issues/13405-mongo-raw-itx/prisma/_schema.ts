import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
  })

  return /* Prisma */ `
${schemaHeader}

    model TestModel {
      id    Int    @id @map("_id")
      field String
    }
  `
})
