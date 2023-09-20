import { NewPrismaClient } from '../../_utils/types'
import { mockAdapter } from '../_utils/mock-adapter'
import { defaultTestSuiteOptions } from '../_utils/test-suite-options'
import testMatrix from './_matrix'
// @ts-ignore
import { PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite((suiteConfig) => {
  test('enforce driverAdapters preview feature', () => {
    const initialize = () => {
      // @ts-test-if: previewFeatures.includes('driverAdapters')
      newPrismaClient({ adapter: mockAdapter(suiteConfig.provider) })
    }

    if (suiteConfig.previewFeatures.includes('driverAdapters')) {
      expect(initialize).not.toThrow()
    } else {
      expect(initialize).toThrowErrorMatchingInlineSnapshot(``)
    }
  })
}, defaultTestSuiteOptions)
