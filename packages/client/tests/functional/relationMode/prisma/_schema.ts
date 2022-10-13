import { computeReferentialActionLine } from '../../_utils/relationMode/computeReferentialActionLine'
import { computeSchemaHeader } from '../../_utils/relationMode/computeSchemaHeader'
import testMatrix from '../_matrix'
import { schema_1to1 } from './_schema_1_to_1'
import { schema_1ton } from './_schema_1_to_n'
import { schema_mton } from './_schema_m_to_n'

export default testMatrix.setupSchema(
  ({ provider, previewFeatures, relationMode, onUpdate, onDelete, id, isSchemaUsingMap }) => {
    const schemaHeader = computeSchemaHeader({ provider, previewFeatures, relationMode })
    const referentialActionLine = computeReferentialActionLine({ onUpdate, onDelete })

    return /* Prisma */ `
${schemaHeader}

${schema_1to1({ id, provider, referentialActionLine, isSchemaUsingMap })}

${schema_1ton({ id, provider, referentialActionLine, isSchemaUsingMap })}

${schema_mton({ id, provider, referentialActionLine, isSchemaUsingMap })}
`
  },
)
