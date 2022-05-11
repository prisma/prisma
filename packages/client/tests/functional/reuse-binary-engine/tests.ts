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

    const internalURL = await ((): Promise<string> =>
      new Promise((resolve) => {
        prismaClient1.$on('info', (data) => {
          if (/Started query engine/.test(data.message as string)) {
            const port = data.message.split(':').pop() // pops off the last one
            resolve(`http://127.0.0.1:${port}`)
          }
        })

        prismaClient1.$connect()
      }))()

    // @ts-ignore
    const prismaClient2 = new PrismaClient({
      __internal: {
        engine: {
          endpoint: internalURL,
        },
      },
    })

    const randomName = 'some-random-name'

    const created = await prismaClient1.user.create({ data: { name: randomName } })
    const [found] = await prismaClient2.user.findMany({ where: { name: randomName } })

    expect(created).toMatchObject(found)

    await prismaClient1.$disconnect()
    await prismaClient2.$disconnect()
    jest.clearAllTimers()
  })
})
