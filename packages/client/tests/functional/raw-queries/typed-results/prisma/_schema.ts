import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  return /* Prisma */ `
${schemaHeader}
    
    model TestModel {
      id     Int       @id
      string String?
      int    Int?
      bInt   BigInt?
      float  Float?
      bytes  Bytes?
      bool   Boolean?
      dt     DateTime?
      dec    Decimal?
    }
  `
})
