import { getTestClient } from '../../../../utils/getTestClient'

test('exit-hook', async () => {
  expect.assertions(2)
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()
  let beforeExitResult
  prisma.$on('beforeExit', () => {
    beforeExitResult = doWork(prisma)
  })
  let processHookCalled = false
  process.on('SIGINT', () => {
    processHookCalled = true
  })
  process.emit('SIGINT', 'SIGINT')
  expect(processHookCalled).toBe(true)
  beforeExitResult = await beforeExitResult
  expect(beforeExitResult).toMatchInlineSnapshot(`
    Array [
      Object {
        email: a@a.de,
        id: 576eddf9-2434-421f-9a86-58bede16fd95,
        name: Alice,
      },
    ]
  `)
  await prisma.$disconnect()
})

async function doWork(prisma) {
  const users = await prisma.user.findMany()
  return users
}
