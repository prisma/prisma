const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
  const db = new PrismaClient()

  const allResults = []
  const engineResults = []

  const order = []

  db.use(async (params, fetch) => {
    order.push(1)
    const result = await fetch(params)
    order.push(4)
    return result
  })

  db.use(async (params, fetch) => {
    order.push(2)
    const result = await fetch(params)
    order.push(3)
    allResults.push(result)
    return result
  })

  db.use('engine', async (params, fetch) => {
    const result = await fetch(params)
    engineResults.push(result)
    return result
  })

  await db.user.findMany()
  await db.post.findMany()

  assert.deepEqual(order, [1, 2, 3, 4, 1, 2, 3, 4])
  assert.deepEqual(allResults, [[], []])
  assert.deepEqual(
    engineResults.map((r) => r.data),
    [
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
    ],
  )
  assert(typeof engineResults[0].elapsed === 'number')
  assert(typeof engineResults[1].elapsed === 'number')

  db.disconnect()
}

if (require.main === module) {
  module.exports()
}
