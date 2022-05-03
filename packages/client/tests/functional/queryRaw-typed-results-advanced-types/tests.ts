import { setupTestSuiteMatrix } from '../_utils/setupTestSuiteMatrix'

// @ts-ignore
declare let prisma: import('@prisma/client').PrismaClient

setupTestSuiteMatrix((suiteConfig) => {
  test('query model with multiple fields', async () => {
    await prisma.testModel.create({
      data: {
        id: 1,
        json: '{"a": "b"}',
        string_list: ['1', 'a', '2', '123123213'],
        bInt_list: [BigInt('-9223372036854775808'), BigInt('9223372036854775807')],
      },
    })

    const testModel = await prisma.$queryRaw`SELECT * FROM "TestModel"`

    const backwardCompatible = !suiteConfig['previewFeatures'].includes('improvedQueryRaw')

    if (backwardCompatible) {
      expect(testModel).toEqual({
        id: 1,
        json: '{"a": "b"}',
        string_list: ['1', 'a', '2', '123123213'],
        bInt_list: ['-9223372036854775808', '9223372036854775807'],
      })
    } else {
      expect(testModel).toEqual({
        id: 1,
        json: '{"a": "b"}',
        string_list: ['1', 'a', '2', '123123213'],
        bInt_list: [BigInt('-9223372036854775808'), BigInt('9223372036854775807')],
      })
    }
  })
})
