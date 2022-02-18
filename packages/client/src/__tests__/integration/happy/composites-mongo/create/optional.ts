import { getTestClient } from '../../../../../utils/getTestClient'

let PrismaClient, prisma

describe('create > optional', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('..')
  })

  beforeEach(async () => {
    prisma = new PrismaClient()
    await prisma.commentRequiredProp.deleteMany({})
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  test('simple', async () => {
    const value = await prisma.commentRequiredProp.count()

    expect(value).toMatchInlineSnapshot(`0`)
  })
})
