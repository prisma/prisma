import { ClientEngineType, getClientEngineType } from '@prisma/sdk'

import testMatrix from './_matrix'

// https://github.com/prisma/prisma/issues/12507
testMatrix.setupTestSuite(() => {
  test('should create data using one PrismaClient and read using another', async () => {
    if (getClientEngineType() !== ClientEngineType.Binary) {
      return
    }

    // @ts-ignore
    const prismaClient1 = new PrismaClient({
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

    // @ts-ignore
    const prismaClient2 = new PrismaClient({
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
