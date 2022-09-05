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

    model User {
      id    ${idForProvider(provider)}
      tasks Task[] @relation("userTask")
    }
    
    model Task {
      id          ${idForProvider(provider)}
      user        User @relation("userTask", fields: [userId], references: [id])
      userId      ${idForProviderType(provider)}
      taskSheet   TaskSheet @relation("taskSheet", fields: [taskSheetId], references: [id])
      taskSheetId ${idForProviderType(provider)}
    }

    model TaskSheet {
      id    ${idForProvider(provider)}
      tasks Task[] @relation("taskSheet")
      date  DateTime
    }
  `
})
