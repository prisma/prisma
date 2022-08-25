import { idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, fieldType, wrongFieldType }) => {
  const foreignKeyType = provider === 'mongodb' ? 'String @db.ObjectId' : 'String'
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
    previewFeatures = ["fieldReference"]
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
