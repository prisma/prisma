import { idForProvider } from '../../../_utils/idForProvider'
import { Providers } from '../../../_utils/providers'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI_${provider}")
    }
    
    model User {
      id ${idForProvider(provider)}
      email   String   @unique
      profile Profile?
    }

    model Profile {
      id ${idForProvider(provider)}
      user      User      @relation(fields: [userId], references: [id])
      userId    ${provider === Providers.MONGODB ? 'String @db.ObjectId' : 'String'} @unique
    }
  `
})
