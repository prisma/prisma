import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, previewFeatures }) => {
  const schemaFeatures = previewFeatures === '' ? '"fieldReference"' : `"fieldReference",${previewFeatures}`
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
    previewFeatures = [${schemaFeatures}]
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }
  
  model User {
    id ${idForProvider(provider)}
    email String @unique
    name String
    createdAt DateTime
    published Boolean
  }

  model Pet {
    id ${idForProvider(provider)}
    name String
  }
  `
})
