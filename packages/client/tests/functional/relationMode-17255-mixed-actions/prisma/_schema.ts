import { computeSchemaHeader } from '../../_utils/relationMode/computeSchemaHeader'
import testMatrix from '../_matrix'
import { schema_mixed_action } from './_schema_mixed_actions'

export default testMatrix.setupSchema(({ provider, relationMode, id }) => {
  const schemaHeader = computeSchemaHeader({ provider, relationMode })

  return /* Prisma */ `
${schemaHeader}

${schema_mixed_action(id)}
`
})
