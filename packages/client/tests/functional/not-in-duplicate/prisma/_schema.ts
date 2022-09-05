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
    
    model Friend {
      id       ${idForProvider(provider)}
      user     User @relation("user", fields: [userId], references: [id], onUpdate: NoAction)
      friend   User @relation("friend", fields: [friendId], references: [id], onUpdate: NoAction)
      userId   ${idForProviderType(provider)}
      friendId ${idForProviderType(provider)}
    }

    model User {
      id          ${idForProvider(provider)}
      userFriends Friend[] @relation("user")
      friendUsers Friend[] @relation("friend")
    }
  `
})
