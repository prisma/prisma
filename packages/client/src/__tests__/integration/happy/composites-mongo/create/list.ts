import { getTestClient } from '../../../../../utils/getTestClient'

let PrismaClient, prisma

describe.skip('create > list', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('..')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await prisma.commentRequiredProp.deleteMany({})
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  test('simple', async () => {
    const value = await prisma.commentRequiredProp.count()

    expect(value).toMatchInlineSnapshot(`1`)
  })
})
