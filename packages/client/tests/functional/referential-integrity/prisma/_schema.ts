import { computeReferentialActionLine } from '../../_utils/referential-integrity/computeReferentialActionLine'
import { computeSchemaHeader } from '../../_utils/referential-integrity/computeSchemaHeader'
import testMatrix from '../_matrix'
import { schema_1to1 } from './_schema_1_to_1'
import { schema_1ton } from './_schema_1_to_n'
import { schema_mton } from './_schema_m_to_n'

export default testMatrix.setupSchema(({ provider, previewFeatures, referentialIntegrity, onUpdate, onDelete, id }) => {
  const schemaHeader = computeSchemaHeader({ provider, previewFeatures, referentialIntegrity })
  const referentialActionLine = computeReferentialActionLine({ onUpdate, onDelete })

  return /* Prisma */ `
${schemaHeader}

${schema_1to1(id, provider, referentialActionLine)}

${schema_1ton(id, provider, referentialActionLine)}

${schema_mton(id, provider, referentialActionLine)}
`
})
