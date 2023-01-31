import { computeReferentialActionLine } from '../../_utils/relationMode/computeReferentialActionLine'
import { computeSchemaHeader } from '../../_utils/relationMode/computeSchemaHeader'
import testMatrix from '../_matrix'
import { schema_1to1 } from './_schema_1_to_1'

export default testMatrix.setupSchema(({ provider, providerFlavor, relationMode, onUpdate, onDelete, id }) => {
  const schemaHeader = computeSchemaHeader({ provider, providerFlavor, relationMode })
  const referentialActionLineOutput = computeReferentialActionLine({ onUpdate, onDelete })

  return /* Prisma */ `
${schemaHeader}

${schema_1to1({ id, provider, referentialActionLineOutput })}
`
})
