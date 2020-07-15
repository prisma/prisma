const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
  const db = new PrismaClient()

  const allResults = []
  const engineResults = []

  db.use('all', async (params, fetch) => {
    const result = await fetch(params)
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
