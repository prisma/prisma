import { generateTestClient } from '../../../../utils/getTestClient'

/* eslint-disable */

test('disconnect-finally', async () => {
  await generateTestClient()
  const PrismaClient = require('./node_modules/@prisma/client').PrismaClient

  let res
  const prisma = new PrismaClient()
  async function main() {
    res = prisma.user.findMany()
  }

  const run = () => {
    return new Promise((resolve) => {
      main().finally(async () => {
        await prisma.$disconnect()
        await res // re-wakes the engine
        prisma.$disconnect()
        resolve(await res)
      })
    })
  }

  const data = await run()
  expect(data).toMatchSnapshot()

  await prisma.$disconnect()
})
