import { computeSchemaHeader } from '../../_utils/computeSchemaHeader'
import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  return /* Prisma */ `
${schemaHeader}

model Child {
  id ${idForProvider(provider)}
  parent Resource? @relation(fields: [parentId], references: [id])
  parentId String?
}

model Resource {
  id ${idForProvider(provider)}
  children Child[]
}
`
})
