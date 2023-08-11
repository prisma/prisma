import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI_${provider}")
    }
    
    generator client {
      provider      = "prisma-client-js"
      binaryTargets = ["native"]
    }

    model User {
      id         ${idForProvider(provider)}
      email      String @unique
    }
  `
})
