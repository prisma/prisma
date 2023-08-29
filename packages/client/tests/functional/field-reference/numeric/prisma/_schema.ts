import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import { idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor, fieldType, wrongFieldType }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
  })

  const foreignKeyType = provider === 'mongodb' ? 'String @db.ObjectId' : 'String'

  return /* Prisma */ `
${schemaHeader}

model Store {
  id ${idForProvider(provider)}
  name String
  products Product[]
}

model Product {
  id ${idForProvider(provider)}
  title String
  quantity ${fieldType}
  minQuantity ${fieldType}
  maxQuantity ${fieldType}
  wrongType ${wrongFieldType}
  storeId ${foreignKeyType}
  store Store @relation(fields: [storeId], references: [id])
}
`
})
