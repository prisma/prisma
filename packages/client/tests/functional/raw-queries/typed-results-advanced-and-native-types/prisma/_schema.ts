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
      id          Int       @id
      json        Json
      string_list String[]
      bInt_list   BigInt[]
      date        DateTime  @db.Date
      time        DateTime  @db.Time(3)
    }
  `
})
