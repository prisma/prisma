import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
      previewFeatures = ["orderByNulls"]
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI_${provider}")
    }
    
    model User {
      id ${idForProvider(provider)}
      age  Int
      name String?
    }
  `
})
