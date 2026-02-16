import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    beforeEach(async () => {
      await prisma.user.deleteMany()
      await prisma.user.create({ data: { content: ["prisma1", "prisma2"] } })
    })

    test('push with single element', async () => {
      const result = await prisma.user.update({
        where: { id: 1 },
        data: {
          content: {
            push: "prisma3",
          },
        },
      })

      expect(result.content).toEqual(["prisma1", "prisma2", "prisma3"])
    })

    test('push with array value', async () => {
      const result = await prisma.user.update({
        where: { id: 1 },
        data: {
          content: {
            push: ["prisma4", "prisma5"],
          },
        },
      })

      expect(result.content).toEqual(["prisma1", "prisma2", "prisma4", "prisma5"])
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mysql', 'sqlserver'],
      reason: 'scalar lists are supported only on postgresql/cockroachdb/mongodb',
    },
  },
)
