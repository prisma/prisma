import { foreignKeyForProvider, idForProvider } from '../../_utils/idForProvider'
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
    createdAt DateTime @default(now())
    published Boolean @default(false)
    organizationId ${foreignKeyForProvider(provider)} @unique
    organization Organization @relation(fields: [organizationId], references: [id])
  }

  model Organization {
    id   ${idForProvider(provider)}
    user User?
  }

  model Pet {
    id ${idForProvider(provider)}
    name String
  }
  `
})
