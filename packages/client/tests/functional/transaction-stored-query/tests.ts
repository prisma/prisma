import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

/**
 * Regression test for comment of #11740
 */
testMatrix.setupTestSuite(() => {
  test('stored query triggered twice should fail but not exit process', async () => {
    const query = prisma.resource.create({ data: { email: 'john@prisma.io' } })

    const result = prisma.$transaction([query, query])

    await expect(result).rejects.toMatchPrismaErrorSnapshot()
  })

  test('stored query trigger .requestTransaction twice should fail', async () => {
    const query = prisma.resource.create({ data: { email: 'john@prisma.io' } })

    const fn = async () => {
      await (query as any).requestTransaction()
      await (query as any).requestTransaction()
    }

    await expect(fn()).rejects.toMatchPrismaErrorSnapshot()
  })

  test('no multiple resolves should happen', async () => {
    const mockMultipleResolve = jest.fn()

    process.on('multipleResolves', mockMultipleResolve)

    const query = prisma.resource.create({ data: { email: 'john@prisma.io' } })

    const result = prisma.$transaction([query, query])

    await expect(result).rejects.toMatchPrismaErrorSnapshot()

    expect(mockMultipleResolve).toHaveBeenCalledTimes(0)
  })
})
