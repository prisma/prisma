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
  { optIn: ['postgresql'] },
)
