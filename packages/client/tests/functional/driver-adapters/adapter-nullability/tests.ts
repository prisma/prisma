import { NewPrismaClient } from '../../_utils/types'
import { defaultTestSuiteOptions } from '../_utils/test-suite-options'
import testMatrix from './_matrix'
// @ts-ignore
import { PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite((_suiteConfig, _suiteMeta, clientMeta) => {
  test('does not throw without the adapter property', () => {
    expect(() => newPrismaClient()).not.toThrow()
  })

  test('does not throw if adapter is set to null', async () => {
    const prisma = newPrismaClient({ adapter: null })

    if (!clientMeta.driverAdapter) {
      await prisma.user.findMany()
    }
  })

  test('throws if adapter is explicitly set to undefined', () => {
    expect(() => newPrismaClient({ adapter: undefined })).toThrowErrorMatchingInlineSnapshot(`
      "adapter" property must not be undefined, use null to conditionally disable driver adapters.
      Read more at https://pris.ly/d/client-constructor
    `)
  })
}, defaultTestSuiteOptions)
