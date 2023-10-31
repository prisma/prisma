import { idForProvider } from '../../../_utils/idForProvider'
import { Providers } from '../../../_utils/providers'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, fieldType, wrongFieldType }) => {
  const foreignKeyType = provider === Providers.MONGODB ? 'String @db.ObjectId' : 'String'
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }

  model Store {
    id ${idForProvider(provider)}
    name String
    products Product[]
  }
  
  model Product {
    id ${idForProvider(provider)}
    title String
    quantity ${fieldType}
    minQuantity ${fieldType}
    maxQuantity ${fieldType}
    wrongType ${wrongFieldType}
    storeId ${foreignKeyType}
    store Store @relation(fields: [storeId], references: [id])
  }
  `
})
