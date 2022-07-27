import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, previewFeatures }) => {
  const index =
    provider === 'mysql'
      ? `@@fulltext([name])
         @@fulltext([name, email])
         @@fulltext([email])`
      : ''
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
    previewFeatures = [${previewFeatures}]
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }
  
  model User {
    id    ${idForProvider(provider)}
    email String @unique
    name  String
    ${index}
  }
  `
})
