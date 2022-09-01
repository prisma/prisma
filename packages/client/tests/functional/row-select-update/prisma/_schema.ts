import { idForProvider, idTypeForProvider } from '../../_utils/idForProvider'
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
    
    model User {
      id    ${idForProvider(provider)}
      posts Post[]
    }

    model Post {
      id       ${idForProvider(provider)}
      content  String
      author   User @relation(fields: [authorId], references: [id])
      authorId ${idTypeForProvider(provider)}
    }
  `
})
