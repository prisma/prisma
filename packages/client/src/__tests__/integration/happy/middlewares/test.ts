import { generateTestClient } from '../../../../utils/getTestClient'

let PrismaClient
beforeAll(async () => {
  await generateTestClient()
  PrismaClient = require('./node_modules/@prisma/client').PrismaClient
})

describe('middleware', () => {
  test('basic', async () => {
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

    await db.$disconnect()
  })

  test('order', async () => {
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

    await db.$disconnect()
  })

  test('engine middleware', async () => {
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

    await db.$disconnect()
  })

  test('modify params', async () => {
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

    // The name should be overwritten by the middleware
    const u = await db.user.findFirst({
      where: {
        name: 'fake',
      },
    })
    expect(u.id).toBe(user.id)
    await db.user.deleteMany()

    await db.$disconnect()
  })

  test('pass new params', async () => {
    const db = new PrismaClient()

    db.$use((params, next) => {
      if (params.action === 'create' && params.model === 'User') {
        return next({
          ...params,
          args: {
            data: {
              ...params.args.data,
              name: 'set from middleware',
            },
          },
        })
      }
      return next(params)
    })

    const { id } = await db.user.create({
      data: {
        email: 'test@test.com',
      },
    })

    const user = await db.user.findFirst({
      where: { id },
    })

    expect(user.name).toBe('set from middleware')

    await db.user.deleteMany()
    await db.$disconnect()
  })

  test('count unpack', async () => {
    const db = new PrismaClient()
    db.$use((params, next) => next(params))
    const result = await db.user.count()
    expect(typeof result).toBe('number')

    await db.$disconnect()
  })

  test('count action', async () => {
    const db = new PrismaClient()

    let action: string | undefined
    db.$use((params, next) => {
      action = params.action
      return next(params)
    })

    await db.user.count()
    expect(action).toBe('count')

    await db.$disconnect()
  })
})
