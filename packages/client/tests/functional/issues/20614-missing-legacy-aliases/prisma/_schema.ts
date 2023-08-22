import { foreignKeyForProvider, idForProvider } from '../../../_utils/idForProvider'
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
  
  model Group {
    id    ${idForProvider(provider)}
    users User[]
  }

  model User {
    id      ${idForProvider(provider)}
    name    String
    group   Group  @relation(fields: [groupId], references: [id])
    groupId ${foreignKeyForProvider(provider)}
  }
  `
})
