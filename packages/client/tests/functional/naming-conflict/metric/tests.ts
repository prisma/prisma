import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('allows to use Metric name for a model', async () => {
    await prisma.metric.create({
      data: {
        name: 'signups',
        value: 9000,
      },
    })

    const metric = await prisma.metric.findFirst()

    expect(metric).toEqual({
      id: expect.any(String),
      name: 'signups',
      value: 9000,
    })
  })
})
