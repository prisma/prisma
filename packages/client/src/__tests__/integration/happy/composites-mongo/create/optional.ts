import { getTestClient } from '../../../../../utils/getTestClient'

let PrismaClient, prisma

describe.skip('create > optional', () => {
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

  test.skip('simple', async () => {
    const value = await prisma.commentRequiredProp.count()

    expect(value).toMatchInlineSnapshot(`0`)
  })
})
