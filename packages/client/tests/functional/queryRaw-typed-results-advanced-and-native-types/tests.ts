import testMatrix from './_matrix'

// @ts-ignore
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite((suiteConfig) => {
  test('query model with multiple fields', async () => {
    await prisma.testModel.create({
      data: {
        id: 1,
        json: { a: 'b' },
        string_list: ['1', 'a', '2', ''],
        bInt_list: [BigInt('-1234'), BigInt('1234')],
        date: new Date('2022-05-04T14:40:06.617Z'),
        time: new Date('2022-05-04T14:40:06.617Z'),
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
          date: '2022-05-04',
          time: '14:40:06.617',
        },
      ])
    } else {
      expect(testModel).toEqual([
        {
          id: 1,
          json: { a: 'b' },
          string_list: ['1', 'a', '2', ''],
          bInt_list: [BigInt('-1234'), BigInt('1234')],
          date: new Date('2022-05-04T00:00:00.000Z'),
          time: new Date('1970-01-01T14:40:06.617Z'),
        },
      ])
    }
  })
})
