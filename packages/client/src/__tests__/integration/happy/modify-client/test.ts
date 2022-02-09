import { getTestClient } from '../../../../utils/getTestClient'

let prisma, PrismaClient
describe('modify-client', () => {
  test('override method', async () => {
    prisma.user.findMany = () => ['override']
    const users = await prisma.user.findMany()
    expect(users).toMatchInlineSnapshot(`
      Array [
        override,
      ]
    `)
  })

  test('class extends', async () => {
    class ExtendedClient extends PrismaClient {
      prop = 'a value'
    }

    const client = new ExtendedClient()
    const users = await client.user.findMany()
    expect(users).toMatchInlineSnapshot(`Array []`)

    client.prop = 'another value'
    expect(client.prop).toMatchInlineSnapshot(`another value`)
  })

  beforeAll(async () => {
    PrismaClient = await getTestClient()
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })
})
