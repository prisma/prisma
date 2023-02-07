import { computeReferentialActionLine } from '../../_utils/relationMode/computeReferentialActionLine'
import { computeSchemaHeader } from '../../_utils/relationMode/computeSchemaHeader'
import testMatrix from '../_matrix'
import { schema_same_actions } from './_schema_same_actions'

export default testMatrix.setupSchema(({ provider, providerFlavor, relationMode, onUpdate, onDelete, id }) => {
  const schemaHeader = computeSchemaHeader({ provider, providerFlavor, relationMode })
  const referentialActionLineOutput = computeReferentialActionLine({ onUpdate, onDelete })

  return /* Prisma */ `
${schemaHeader}

${schema_same_actions({ id, provider, referentialActionLineOutput })}
`
})
