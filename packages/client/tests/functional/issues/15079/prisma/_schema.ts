import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import { idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
  })

  return /* Prisma */ `
${schemaHeader}

model aktivasi_bku {
  id ${idForProvider(provider)}
  id_periode             Decimal      @db.Decimal(2, 0)
}
`
})
