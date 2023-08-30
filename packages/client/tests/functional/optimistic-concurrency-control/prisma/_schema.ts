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

model Resource {
  id       ${idForProvider(provider)}
  occStamp Int @default(0) @unique
  child    Child?
}

model Child {
  id       ${idForProvider(provider)}
  parent   Resource @relation(fields: [parentId], references: [id], onDelete: Cascade)
  parentId String @unique
}
`
})
