import { getTestClient } from '../../../../utils/getTestClient'

describe('middleware', () => {
  test('basic', async () => {
    const PrismaClient = await getTestClient()

    const db = new PrismaClient()

    const allResults: any[] = []

    db.$use(async (params, next) => {
      expect(params).toMatchSnapshot()

      const result = await next(params)
      allResults.push(result)
      return result
    })

    await db.user.findMany()
    await db.post.findMany()

    expect(allResults).toEqual([[], []])

    db.$disconnect()
  })

  test('order', async () => {
    const PrismaClient = await getTestClient()
    const db = new PrismaClient()
    const order: number[] = []

    db.$use(async (params, next) => {
      order.push(1)
      const result = await next(params)
      order.push(4)
      return result
    })

    db.$use(async (params, next) => {
      order.push(2)
      const result = await next(params)
      order.push(3)
      return result
    })

    await db.user.findMany()
    await db.post.findMany()

    expect(order).toEqual([1, 2, 3, 4, 1, 2, 3, 4])

    db.$disconnect()
  })

  test('engine middleware', async () => {
    const PrismaClient = await getTestClient()
    const db = new PrismaClient()

    const engineResults: any[] = []

    db.$use('engine', async (params, next) => {
      const result = await next(params)
      engineResults.push(result)
      return result
    })

    await db.user.findMany()
    await db.post.findMany()
    expect(engineResults.map((r) => r.data)).toEqual([
      {
        data: {
          findManyUser: [],
        },
      },
      {
        data: {
          findManyPost: [],
        },
      },
    ])
    expect(typeof engineResults[0].elapsed).toEqual('number')
    expect(typeof engineResults[1].elapsed).toEqual('number')

    db.$disconnect()
  })

  test('modify params', async () => {
    const PrismaClient = await getTestClient()
    const db = new PrismaClient()

    const user = await db.user.create({
      data: {
        email: 'test@test.com',
        name: 'test',
      },
    })
    db.$use(async (params, next) => {
      if (params.action === 'findFirst' && params.model === 'User') {
        params.args = { ...params.args, where: { name: 'test' } }
      }
      const result = await next(params)
      return result
    })

    const users = await db.user.findMany()
    console.warn(users)
    // The name should be overwritten by the middleware
    const u = await db.user.findFirst({
      where: {
        name: 'fake',
      },
    })
    expect(u.id).toBe(user.id)
    await db.user.deleteMany()

    db.$disconnect()
  })

  test('count unpack', async () => {
    const PrismaClient = await getTestClient()
    const db = new PrismaClient()
    db.$use((params, next) => next(params))
    const result = await db.user.count()
    expect(typeof result).toBe('number')

    db.$disconnect()
  })
})
