const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
  const prisma = new PrismaClient()

  let theParams
  let firstCall = true
  prisma.use(async (params, fetch) => {
    theParams = JSON.parse(JSON.stringify(params)) // clone
    if (firstCall) {
      params.args = {
        where: {
          email: 'asdasd', // this user doesn't exist
        },
      }
      firstCall = false
    }
    const result = await fetch(params)
    return result
  })

  prisma.use(async (params, fetch) => {
    const result = await fetch(params)
    if (result.length > 0) {
      result[0].name += '2' // make sure that we can change the result
    }
    return result
  })

  const users = await prisma.user.findMany()

  assert.deepEqual(theParams, {
    dataPath: [],
    runInTransaction: false,
    action: 'findMany',
    model: 'User',
  })

  assert.deepEqual(users, [])

  const users2 = await prisma.user.findMany()
  assert.deepEqual(users2, [
    {
      email: 'a@a.de',
      id: '576eddf9-2434-421f-9a86-58bede16fd95',
      name: 'Alice2',
    },
  ])

  prisma.disconnect()
}

if (require.main === module) {
  module.exports()
}
