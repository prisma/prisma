import { getTestClient } from '../../../../utils/getTestClient'

let PrismaClient, prisma

describe('long-running transaction', () => {
  test('basic', async () => {
    const result = await prisma.$transaction(async (prisma) => {
      await prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })

      await prisma.user.create({
        data: {
          email: 'user_2@website.com',
        },
      })

      return prisma.user.findMany()
    })

    expect(result.length).toBe(2)
  })

  test('timeout', async () => {
    const result = prisma.$transaction(async (prisma) => {
      await prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })

      await new Promise((res) => setTimeout(res, 6000))

      return prisma.user.findMany()
    })

    await expect(result).rejects.toThrowError()
  })

  test('nested', async () => {
    const result = await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })

      await prisma.$transaction(async (prisma) => {
        await prisma.user.create({
          data: {
            email: 'user_2@website.com',
          },
        })
      })

      return tx.user.findMany()
    })

    expect(result.length).toBe(2)
  })
})

beforeAll(async () => {
  PrismaClient = await getTestClient()

  process.env.PRISMA_FORCE_LRT = 'true'
})

afterAll(() => {
  delete process.env.PRISMA_FORCE_LRT
})

beforeEach(async () => {
  prisma = new PrismaClient()

  await prisma.user.deleteMany()
})

afterEach(async () => {
  await prisma.$disconnect()
})
