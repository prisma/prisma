import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import { idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  const compatibleTypes =
    provider !== 'sqlite'
      ? `
          date DateTime @db.Date 
          time DateTime @db.Time
        `
      : ''

  return /* Prisma */ `
${schemaHeader}
    
model User {
  id ${idForProvider(provider)}
  dateTime DateTime
  uuid String @default(uuid())
  ${compatibleTypes}
}
`
})
