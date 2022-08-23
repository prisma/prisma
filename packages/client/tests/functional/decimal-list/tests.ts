import { setupTestSuiteMatrix } from '../_utils/setupTestSuiteMatrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

setupTestSuiteMatrix(
  () => {
    test('with decimal instances', async () => {
      await prisma.user.create({
        data: {
          decimals: [12.3, 45.6],
        },
      })
    })

    test('with numbers', async () => {
      await prisma.user.create({
        data: {
          decimals: [12.3, 45.6],
        },
      })
    })

    test('create with strings', async () => {
      await prisma.user.create({
        data: {
          decimals: ['12.3', '45.6'],
        },
      })
    })
  },
  {
    optOut: {
      from: ['mongodb', 'mysql', 'sqlite', 'sqlserver'],
      reason: `
        mongodb: connector does not support the Decimal type. 
        mysql & sqlite: connectors do not support lists of primitive types.
        sqlserver: Field "decimals" in model "User" can't be a list. The current connector does not support lists of primitive types.
      `,
    },
  },
)
