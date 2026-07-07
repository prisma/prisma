import { foreignKeyForProvider, idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
  }

  datasource db {
    provider = "${provider}"
  }

  model Author {
    id    ${idForProvider(provider)}
    name  String
    books Book[]
  }

  model Book {
    id       ${idForProvider(provider)}
    title    String
    tags     BigInt[]
    prices   Decimal[]
    strs     String[]
    ints     Int[]
    author   Author @relation(fields: [authorId], references: [id], onDelete: Cascade)
    authorId ${foreignKeyForProvider(provider)}
  }
  `
})
