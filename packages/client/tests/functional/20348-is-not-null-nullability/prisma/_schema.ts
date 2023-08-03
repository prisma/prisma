import { foreignKeyForProvider, idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }
  
  model User {
    id ${idForProvider(provider)}
    info Info? @relation(fields: [infoId], references: [id])
    infoId ${foreignKeyForProvider(provider)}? @unique
  }

  model Info {
    id ${idForProvider(provider)}
    name String
    user User?
  }
  `
})
