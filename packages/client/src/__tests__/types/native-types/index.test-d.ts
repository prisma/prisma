import { PrismaClient } from '.'
import { expectError } from 'tsd'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:dev.db',
    },
  },
})

;(async () => {
  expectError(
    await prisma.a.findFirst({
      where: {
        bInt: '123',
      },
    }),
  )
  expectError(
    await prisma.d.findFirst({
      where: {
        byteA: 'no string allowed. only buffer',
      },
    }),
  )
})()
