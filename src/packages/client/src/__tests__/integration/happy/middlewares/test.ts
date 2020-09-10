import { getTestClient } from '../../../../utils/getTestClient'

test('middlewares', async () => {
  const PrismaClient = await getTestClient()
  const db = new PrismaClient()

  const allResults: any[] = []
  const engineResults: any[] = []

  const order: number[] = []

  db.$use(async (params, fetch) => {
    order.push(1)
    const result = await fetch(params)
    order.push(4)
    return result
  })

  db.$use(async (params, fetch) => {
    order.push(2)
    const result = await fetch(params)
    order.push(3)
    allResults.push(result)
    return result
  })

  db.$use('engine', async (params, fetch) => {
    const result = await fetch(params)
    engineResults.push(result)
    return result
  })

  await db.user.findMany()
  await db.post.findMany()

  expect(order).toEqual([1, 2, 3, 4, 1, 2, 3, 4])
  expect(allResults).toEqual([[], []])
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
