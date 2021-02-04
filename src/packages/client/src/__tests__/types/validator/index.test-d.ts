import { PrismaClient, Prisma } from '.'
import { expectError } from 'tsd'

// tslint:disable

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:dev.db',
    },
  },
})

;(async () => {
  const validator = Prisma.validator<Prisma.UserSelect>()

  expectError(
    validator({
      asd: true,
    }),
  )

  expectError(
    validator({
      asd: true,
      id: true,
    }),
  )
})()
