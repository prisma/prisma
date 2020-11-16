import { getTestClient } from '../../../../utils/getTestClient'

test('findOne deprecation warning', async () => {
  const spy = jest.spyOn(console, 'warn').mockImplementation()
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()
  const user = await prisma.user.findOne({ where: { email: 'a@a.de' } })
  await prisma.$disconnect()
  expect(user).toMatchInlineSnapshot(`
    Object {
      email: a@a.de,
      id: 576eddf9-2434-421f-9a86-58bede16fd95,
      name: Alice,
    }
  `)
  expect(spy.mock.calls.join('\n')).toMatchInlineSnapshot(
    `warn(prisma)  findOne is deprecated. Please use findUnique instead.`,
  )
  spy.mockRestore()
})
