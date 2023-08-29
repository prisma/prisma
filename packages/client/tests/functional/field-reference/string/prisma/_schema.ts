import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import { idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  const fields = /* Prisma */ `
    id ${idForProvider(provider)}
    string String
    otherString String
    notString Int
  `
  return /* Prisma */ `
${schemaHeader}

model Product {
  ${fields}
}

model IdenticalToProduct {
  ${fields}
}

model OtherModel {
  id ${idForProvider(provider)}
  string String
}
`
})
