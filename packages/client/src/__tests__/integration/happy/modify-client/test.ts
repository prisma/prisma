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

  test('override model', () => {
    prisma.profile = ['override']

    expect(prisma.profile).toMatchInlineSnapshot(`
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
    client.prop = 'another value'

    expect(users).toMatchInlineSnapshot(`Array []`)
    expect(client.prop).toMatchInlineSnapshot(`another value`)

    await client.$disconnect()
  })

  test('class extends keys', async () => {
    class ExtendedClient extends PrismaClient {
      prop = 'a value'
    }
    const client = new ExtendedClient()
    client.prop2 = 'another value'

    expect(Object.keys(client).filter((k) => !k.startsWith('_'))).toMatchInlineSnapshot(`
      Array [
        user,
        profile,
        post,
        prop,
        prop2,
      ]
    `)

    await client.$disconnect()
  })

  test('class extends override', async () => {
    class ExtendedClient extends PrismaClient {
      $connect() {
        return ['override']
      }
    }
    const client = new ExtendedClient()

    expect(client.$connect()).toMatchInlineSnapshot(`
      Array [
        override,
      ]
    `)

    await client.$disconnect()
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
