import { computeSchemaHeader } from '../../_utils/computeSchemaHeader'
import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor, mapTable }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
    providerFlavor,
    previewFeatures: 'multiSchema',
    schemas: ['base', 'transactional'],
  })

  const mapTableUser = mapTable === 'IDENTICAL_NAMES' ? 'some_table' : 'some_table_user'
  const mapTablePost = mapTable === 'IDENTICAL_NAMES' ? 'some_table' : 'some_table_post'

  return /* Prisma */ `
${schemaHeader}

model User {
  id ${idForProvider(provider)}
  email String
  posts Post[]

  @@schema("base")
  ${mapTable ? `@@map("${mapTableUser}")` : ''}
}

model Post {
  id ${idForProvider(provider)}
  title     String
  authorId  String
  author    User?    @relation(fields: [authorId], references: [id])

  @@schema("transactional")
  ${mapTable ? `@@map("${mapTablePost}")` : ''}
}
  `
})
