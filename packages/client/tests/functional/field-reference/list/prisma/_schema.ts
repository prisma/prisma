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

model Product {
  id ${idForProvider(provider)}
  title String
  quantity Int
  forbiddenQuantities Int[]
  enum1 MyEnum
  enum2 MyEnum[]
}

enum MyEnum {
  a
  b
  c
}
`
})
