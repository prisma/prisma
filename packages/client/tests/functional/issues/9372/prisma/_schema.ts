import { computeSchemaHeader } from '../../../_utils/computeSchemaHeader'
import { idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }): string => {
  const schemaHeader = computeSchemaHeader({
    provider,
  })

  const foreignKey = provider === 'mongodb' ? 'String? @db.ObjectId' : 'String?'

  return /* Prisma */ `
${schemaHeader}

  
  model Dictionary {
    id     ${idForProvider(provider)}
    entries Entry[]
  }

  model Entry {
    id           ${idForProvider(provider)}
    term         String
    dictionaryID ${foreignKey}

    Dictionary Dictionary? @relation(fields: [dictionaryID], references: [id])
  }
  `
})
