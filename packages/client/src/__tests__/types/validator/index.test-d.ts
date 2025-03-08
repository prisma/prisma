import { expectError } from 'tsd'

import { Prisma, PrismaClient } from '.'

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
