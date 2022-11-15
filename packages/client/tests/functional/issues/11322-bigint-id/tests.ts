// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/11322
testMatrix.setupTestSuite(
  () => {
    beforeAll(async () => {
      await prisma.component.createMany({
        data: [
          {
            id: 1,
            title: 'Blog',
          },
          {
            id: 2,
            title: 'Blog 2',
          },
        ],
      })

      await prisma.componentCategory.createMany({
        data: [
          {
            id: 1,
            name: 'Blog',
          },
        ],
      })

      await prisma.component.update({
        where: { id: 1 },
        data: {
          categories: { set: { id: 1 } },
        },
      })
      await prisma.component.update({
        where: { id: 2 },
        data: {
          categories: { set: { id: 1 } },
        },
      })
    })

    test('example', async () => {
      const components = await prisma.component.findMany({ include: { categories: true } })
      expect(components[0].categories[0].id).toBe(BigInt('1'))
      expect(components[1].categories[0].id).toBe(BigInt('1'))
    })
  },
  {
    optOut: {
      from: ['sqlite', 'postgresql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'mysql specific problem',
    },
  },
)
