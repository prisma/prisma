import { computeReferentialActionLine } from '../../_utils/relationMode/computeReferentialActionLine'
import { computeSchemaHeader } from '../../_utils/relationMode/computeSchemaHeader'
import testMatrix from '../_matrix'
import { schema_mixed_action } from './_schema_mixed_actions'

export default testMatrix.setupSchema(({ provider, providerFlavor, relationMode, onUpdate, onDelete, id }) => {
  const schemaHeader = computeSchemaHeader({ provider, providerFlavor, relationMode })
  const referentialActionLineOutput = computeReferentialActionLine({ onUpdate, onDelete })

  return /* Prisma */ `
${schemaHeader}

${schema_mixed_action({ id, provider, referentialActionLineOutput })}
`
})
