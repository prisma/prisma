import { idForProvider, idForProviderType } from '../../_utils/idForProvider'
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

    model Parent {
      id         ${idForProvider(provider)}
      resource   Resource @relation("Resource", fields: [resourceId], references: [id], onUpdate: NoAction)
      resourceId ${idForProviderType(provider)} @unique
    }

    model Resource {
      id          ${idForProvider(provider)}
      dependsOn   Resource? @relation("DependsOn", fields: [dependsOnId], references: [id], onUpdate: NoAction)
      dependsOnId ${idForProviderType(provider)}
      dependedOn  Resource[] @relation("DependsOn")
      parent      Parent? @relation("Resource")
    }
  `
})
