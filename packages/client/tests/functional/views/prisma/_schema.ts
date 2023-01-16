import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
      previewFeatures = ["views"]
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI_${provider}")
    }
    
    model User {
      id ${idForProvider(provider)}
      email   String   @unique
      name    String?
      profile Profile?
    }

    model Profile {
      id ${idForProvider(provider)}
      bio       String
      user      User   @relation(fields: [userId], references: [id])
      userId    String    @unique
    }

    view UserInfo {
      id    ${idForProvider(provider)}
      email String
      name  String
      bio   String
    }
  `
})
