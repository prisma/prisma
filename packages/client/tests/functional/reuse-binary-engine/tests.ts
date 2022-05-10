import * as util from 'util'

import { setupTestSuiteMatrix } from '../_utils/setupTestSuiteMatrix'

// https://github.com/prisma/prisma/issues/12507
setupTestSuiteMatrix(() => {
  test('should create data using one PrismaClient and read using another', async () => {
    // @ts-ignore
    const prismaClient1 = new PrismaClient({
      log: [
        {
          emit: 'event',
          level: 'info',
        },
      ],
    })

    let prismaClient2 = undefined
    let internalURL = ''

    prismaClient1.$on('info', (data) => {
      if (/Started query engine/.test(data.message)) {
        const words = data.message.split(' ')
        const url = words[words.length - 1]
        const lh = 'http://127.0.0.1'
        const [, port] = url.split(lh + ':')

        internalURL = `${lh}:${port}`
      }
    })

    await prismaClient1.$connect()

    await (() => {
      return new Promise((resolve) => {
        const interval = setInterval(async () => {
          if (!internalURL) {
            await util.promisify(setTimeout)(0)
          }

          // @ts-ignore
          prismaClient2 = new PrismaClient({
            __internal: {
              engine: {
                endpoint: internalURL,
              },
            },
          })

          clearInterval(interval)

          // @ts-ignore
          resolve()
        }, 100)
      })
    })()

    const randomName = 'some-random-name'

    const created = await prismaClient1.user.create({ data: { name: randomName } })
    // @ts-ignore
    const [found] = await prismaClient2.user.findMany({ where: { name: randomName } })

    expect(created).toMatchObject(found)

    await prismaClient1.$disconnect()
    // @ts-ignore
    await prismaClient2.$disconnect()
  })
})
