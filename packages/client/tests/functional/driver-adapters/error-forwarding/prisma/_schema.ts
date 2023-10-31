import { foreignKeyForProvider, idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
    previewFeatures = ["driverAdapters"]
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }
  
  model User {
    id ${idForProvider(provider)}
    profile Profile? 
  }

  model Profile {
    id ${idForProvider(provider)}
    userId ${foreignKeyForProvider(provider)} @unique
    user User @relation(fields: [userId], references: [id])
  }
  `
})
