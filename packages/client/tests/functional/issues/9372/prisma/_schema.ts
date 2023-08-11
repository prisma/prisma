import { idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  const foreignKey = provider === 'mongodb' ? 'String? @db.ObjectId' : 'String?'
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }
  
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
