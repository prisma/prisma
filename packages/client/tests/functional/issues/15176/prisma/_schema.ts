import { idForProvider } from '../../../_utils/idForProvider'
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
    
    model TestModel {
      id                    ${idForProvider(provider)}
      bool                  Boolean?
      updatedAt_w_default   DateTime  @default(now()) @updatedAt
      updatedAt_wo_default  DateTime? @updatedAt
      createdAt             DateTime  @default(now())
    }
  `
})
