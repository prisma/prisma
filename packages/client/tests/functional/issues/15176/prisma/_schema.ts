import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import { idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  return /* Prisma */ `
${schemaHeader}
    
model TestModel {
  id                    ${idForProvider(provider)}
  bool                  Boolean?
  updatedAt_w_default   DateTime  @default(now()) @updatedAt
  updatedAt_wo_default  DateTime? @updatedAt
  createdAt             DateTime  @default(now())
}
`
})
