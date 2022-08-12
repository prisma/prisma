import testMatrix from './_matrix'

// @ts-ignore
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('simple object', async () => {
      const result = await prisma.entry.create({
        data: { json: { x: 1 } },
      })
      expect(result).toMatchObject({
        json: { x: 1 },
      })
    })

    test('empty object', async () => {
      const result = await prisma.entry.create({
        data: { json: {} },
      })
      expect(result).toMatchObject({
        json: {},
      })
    })

    // Regression test for https://github.com/prisma/prisma/issues/14274
    // and https://github.com/prisma/prisma/issues/14342
    test('object with no prototype', async () => {
      const result = await prisma.entry.create({
        data: { json: Object.create(null) },
      })
      expect(result).toMatchObject({
        json: {},
      })
    })
  },
  {
    optOut: {
      from: ['sqlite', 'sqlserver'],
      reason: `
        sqlite - connector does not support Json type
        sqlserver - connector does not support Json type
      `,
    },
  },
)
