import { ClientEngineType, getClientEngineType } from '@prisma/internals'

import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
type PrismaClient = import('@prisma/client').PrismaClient
// @ts-ignore this is just for type checks
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

// https://github.com/prisma/prisma/issues/12507
testMatrix.setupTestSuite(() => {
  test('should create data using one PrismaClient and read using another', async () => {
    if (getClientEngineType() !== ClientEngineType.Binary) {
      return
    }

    const prismaClient1 = newPrismaClient({
      log: [
        {
          emit: 'event',
          level: 'info',
        },
      ],
    })

    const internalURL = await ((): Promise<string> =>
      new Promise((resolve, reject) => {
        prismaClient1.$on('info', (data) => {
          if (/Started query engine/.test(data.message as string)) {
            const port = data.message.split(':').pop()
            resolve(`http://127.0.0.1:${port}`)
          }
        })

        prismaClient1.$connect().catch(reject)
      }))()

    const prismaClient2 = newPrismaClient({
      // @ts-ignore
      __internal: {
        engine: {
          endpoint: internalURL,
        },
      },
    })

    const name = 'some-random-name'

    const created = await prismaClient1.user.create({ data: { name } })
    const [found] = await prismaClient2.user.findMany({ where: { name } })

    expect(created).toMatchObject(found)

    await prismaClient1.$disconnect()
    await prismaClient2.$disconnect()
  })
})
