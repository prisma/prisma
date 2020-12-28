import { PrismaClient } from '.'
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
  expectError(
    await prisma.$transaction(
      [prisma.user.findMany(), prisma.$queryRaw`SELECT 1`, 'rrandom string'],
      {},
    ), // TODO: this should fail without the {}
  )
})()
