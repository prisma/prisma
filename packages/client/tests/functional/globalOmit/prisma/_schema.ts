import { foreignKeyForProvider, idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
      generator client {
        provider = "prisma-client-js"
        previewFeatures = ["omitApi"]
      }
      
      datasource db {
        provider = "${provider}"
        url      = env("DATABASE_URI_${provider}")
      }

      model UserGroup {
        id ${idForProvider(provider)}
        name String
        users User[]
      }
      
      model User {
        id ${idForProvider(provider)}
        email String @unique
        password String
        groupId ${foreignKeyForProvider(provider, { optional: true })}
        group UserGroup? @relation(fields: [groupId], references: [id])
      }
      `
})
