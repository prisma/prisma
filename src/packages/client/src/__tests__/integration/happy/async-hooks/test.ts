import { executionAsyncId } from 'async_hooks'
import { getTestClient } from '../../../../utils/getTestClient'

test('async-hooks', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()
  let asyncId
  prisma.$use((params, fetch) => {
    asyncId = executionAsyncId()
    return fetch(params)
  })

  await prisma.user.findMany()
  expect(asyncId).toBeGreaterThan(0)

  await prisma.$disconnect()
})
