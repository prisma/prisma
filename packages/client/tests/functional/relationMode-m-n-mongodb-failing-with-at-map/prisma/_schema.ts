import { computeReferentialActionLine } from '../../_utils/relationMode/computeReferentialActionLine'
import { computeSchemaHeader } from '../../_utils/relationMode/computeSchemaHeader'
import testMatrix from '../_matrix'
import { schema_mton } from './_schema_m_to_n'

export default testMatrix.setupSchema(({ provider, relationMode, onUpdate, onDelete, id }) => {
  const schemaHeader = computeSchemaHeader({ provider, relationMode })
  const referentialActionLineOutput = computeReferentialActionLine({ onUpdate, onDelete })

  return /* Prisma */ `
${schemaHeader}

${schema_mton({ id, provider, referentialActionLineOutput })}
`
})
