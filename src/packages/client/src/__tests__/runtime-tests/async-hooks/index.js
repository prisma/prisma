const { PrismaClient } = require('@prisma/client')
const assert = require('assert')
const { executionAsyncId } = require('async_hooks')

module.exports = async () => {
  const prisma = new PrismaClient()

  let asyncId
  prisma.use(async (params, fetch) => {
    asyncId = executionAsyncId()
    return fetch(params)
  })

  await prisma.user.findMany()
  assert(asyncId > 0)

  prisma.disconnect()
}

if (require.main === module) {
  module.exports()
}
