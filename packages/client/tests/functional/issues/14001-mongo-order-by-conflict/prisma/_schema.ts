import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import { idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
  })

  return /* Prisma */ `
${schemaHeader}

model Resource {
  id      ${idForProvider(provider)}
  OrderBy Int @unique()
}
`
})
