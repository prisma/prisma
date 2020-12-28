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
    await prisma.userTest.findUnique({
      where: {
        id: 'Example',
      },
      select: {
        id: true,
        globalConfiguration: {
          select: {
            accounts: {
              select: {
                config: {
                  select: {
                    list: true,
                    data: false,
                    asd: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  )
})()
