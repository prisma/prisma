import { computeReferentialActionLine } from '../../_referential-integrity-utils/computeReferentialActionLine'
import { computeSchemaHeader } from '../../_referential-integrity-utils/computeSchemaHeader'
import testMatrix from '../_matrix'
import { schema_1to1 } from './_schema_1_to_1'
import { schema_1ton } from './_schema_1_to_n'
import { schema_mton } from './_schema_m_to_n'

export default testMatrix.setupSchema(({ provider, previewFeatures, referentialIntegrity, referentialActions, id }) => {
  const schemaHeader = computeSchemaHeader({ provider, previewFeatures, referentialIntegrity })
  const referentialActionLine = computeReferentialActionLine({ referentialActions })

  return /* Prisma */ `
${schemaHeader}

${schema_1to1(id, provider, referentialActionLine)}

${schema_1ton(id, provider, referentialActionLine)}

${schema_mton(id, provider, referentialActionLine)}
`
})
