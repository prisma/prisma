import { executionAsyncId } from 'async_hooks'

import { generateTestClient } from '../../../../utils/getTestClient'

test('async-hooks', async () => {
  await generateTestClient()
  const PrismaClient = require('./node_modules/@prisma/client').PrismaClient
  const prisma = new PrismaClient()
  let asyncId
  prisma.$use((params, next) => {
    asyncId = executionAsyncId()
    return next(params)
  })

  await prisma.user.findMany()
  expect(asyncId).toBeGreaterThan(0)

  await prisma.$disconnect()
})
