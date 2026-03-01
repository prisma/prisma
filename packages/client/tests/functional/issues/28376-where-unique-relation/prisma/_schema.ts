import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  const id = idForProvider(provider)
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
    }

    datasource db {
      provider = "${provider}"
    }

    model User {
      id           ${id}
      email        String          @unique
      formResponses FormResponse[]
    }

    model Form {
      id        ${id}
      title     String
      responses FormResponse[]
    }

    model FormResponse {
      id        ${id}
      creator   User   @relation(fields: [creatorId], references: [id], onDelete: Cascade)
      creatorId String
      form      Form   @relation(fields: [formId], references: [id], onDelete: Cascade)
      formId    String

      @@unique([creatorId, formId])
    }
  `
})

