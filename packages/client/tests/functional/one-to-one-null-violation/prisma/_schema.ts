import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFeatures }) => {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
      previewFeatures = [${providerFeatures}]
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI_${provider}")
    }
    
    model ResourceHolder {
      id         ${idForProvider(provider)}
      resourceId String? @unique
      resource   Resource?
    }

    model Resource {
      id             ${idForProvider(provider)}
      resourceHolder ResourceHolder @relation(fields: [id], references: [resourceId])
    }
  `
})
