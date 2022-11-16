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
    
    model Student {
      id           ${idForProvider(provider)}
      name         String
      StudentClass StudentClass[]
    }

    model Class {
      id           ${idForProvider(provider)}
      name         String
      StudentClass StudentClass[]
    }

    model StudentClass {
      id           ${idForProvider(provider)}
      studentId String
      classId   String
      student   Student @relation(fields: [studentId], references: [id])
      class     Class   @relation(fields: [classId], references: [id])
    }
  `
})
