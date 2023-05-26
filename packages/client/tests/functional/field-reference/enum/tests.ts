// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    beforeAll(async () => {
      await prisma.testModel.create({
        data: {
          enum1: 'a',
          enum2: 'a',
        },
      })

      await prisma.testModel.create({
        data: {
          enum1: 'a',
          enum2: 'b',
        },
      })
    })

    test('simple enum equality', async () => {
      const result = await prisma.testModel.findMany({ where: { enum1: { equals: prisma.testModel.fields.enum2 } } })

      expect(result).toEqual([expect.objectContaining({ enum1: 'a', enum2: 'a' })])
    })
  },
  {
    optOut: { from: ['sqlserver', 'sqlite'], reason: 'Enums are not supported' },
  },
)
