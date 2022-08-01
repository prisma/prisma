import { computeReferentialActionLine } from '../../_referential-integrity-utils/computeReferentialActionLine'
import { computeSchemaHeader } from '../../_referential-integrity-utils/computeSchemaHeader'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, previewFeatures, referentialIntegrity, referentialActions, id }) => {
  const schemaHeader = computeSchemaHeader({ provider, previewFeatures, referentialIntegrity })
  const referentialActionLine = computeReferentialActionLine({ referentialActions })

  const models = /* prisma */ `
model User {
  id      ${id}
  profile Profile?
  enabled Boolean?
}
model Profile {
  id       ${id}
  user     User @relation(fields: [userId], references: [id]${referentialActionLine})
  userId   String @unique
  enabled Boolean?
}
`

  const schema = /* prisma */ `
${schemaHeader}

${models}
`

  return schema
})
