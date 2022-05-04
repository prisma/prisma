import { setupTestSuiteMatrix } from '../_utils/setupTestSuiteMatrix'

// @ts-ignore
declare let prisma: import('@prisma/client').PrismaClient

setupTestSuiteMatrix((suiteConfig) => {
  test('query model with multiple fields', async () => {
    await prisma.testModel.create({
      data: {
        id: 1,
        json: { a: 'b' },
        string_list: ['1', 'a', '2', ''],
        bInt_list: [BigInt('-1234'), BigInt('1234')],
      },
    })

    const testModel = await prisma.$queryRaw`SELECT * FROM "TestModel"`

    const backwardCompatible = !suiteConfig['previewFeatures'].includes('improvedQueryRaw')

    if (backwardCompatible) {
      expect(testModel).toEqual([
        {
          id: 1,
          json: { a: 'b' },
          string_list: ['1', 'a', '2', ''],
          bInt_list: [-1234, 1234],
        },
      ])
    } else {
      expect(testModel).toEqual([
        {
          id: 1,
          json: { a: 'b' },
          string_list: ['1', 'a', '2', ''],
          bInt_list: [BigInt('-1234'), BigInt('1234')],
        },
      ])
    }
  })
})
