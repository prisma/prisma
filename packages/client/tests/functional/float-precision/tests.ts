import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

const floatValue = -111.49259312072274
testMatrix.setupTestSuite(({ provider }) => {
  // https://github.com/prisma/prisma/issues/11096
  beforeAll(async () => {
    await prisma.testModel.create({
      data: { floatValue },
    })
  })

  test.failing('floats do not lose precision', async () => {
    const record = await prisma.testModel.findFirstOrThrow({ where: { floatValue } })

    expect(record.floatValue).toBe(floatValue)
  })

  testIf(provider !== 'mongodb').failing('raw query does not loses precision', async () => {
    let result
    if (provider === 'sqlserver') {
      result = await prisma.$queryRaw`SELECT * FROM [TestModel]`
    } else {
      result = await prisma.$queryRaw`SELECT * FROM TestModel`
    }

    expect(result?.[0]?.floatValue).toBe(floatValue)
  })
})
