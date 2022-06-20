import { getTestClient } from '../../../../utils/getTestClient'

describe('context', () => {
  test('basic', async () => {
    const PrismaClient = await getTestClient()

    const db = new PrismaClient()

    db.$use((params, next) => {
      expect(params).toMatchSnapshot()
      return next(params)
    })

    await db.user.findMany()

    await db.$disconnect()
  })

  test('findMany', async () => {
    const PrismaClient = await getTestClient()

    const db = new PrismaClient()

    db.$use((params, next) => {
      expect(params).toMatchSnapshot()
      return next(params)
    })

    await db.user.findMany({
      where: {
        id: {
          in: ['1', '2'],
        },
      },
      context: {
        cache: 500,
      },
    })

    await db.$disconnect()
  })

  test('middleware pipeline', async () => {
    const PrismaClient = await getTestClient()

    const db = new PrismaClient()

    db.$use((params, next) => next(params))
    db.$use((params, next) => {
      expect(params).toMatchSnapshot()
      return next(params)
    })

    await db.user.findFirst({
      select: {
        id: true,
        name: true,
      },
      where: {
        name: 'test',
        email: 'test@example.com',
      },
      context: {
        test: {
          test: {
            test: 'test',
          },
        },
      },
    })

    await db.$disconnect()
  })
})
