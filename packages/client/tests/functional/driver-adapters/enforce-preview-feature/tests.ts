import type { NewPrismaClient } from '../../_utils/types'
import { mockAdapter } from '../_utils/mock-adapter'
import { defaultTestSuiteOptions } from '../_utils/test-suite-options'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite((suiteConfig, _, clientMeta) => {
  // Skip testing with driver adapters configured by the test setup
  // because we need full control over the preview features in this test.
  testIf(!clientMeta.driverAdapter)('enforce driverAdapters preview feature', () => {
    const initialize = () => {
      // @ts-test-if: previewFeatures.includes('driverAdapters')
      newPrismaClient({ adapter: mockAdapter(suiteConfig.provider) })
    }

    if (suiteConfig.previewFeatures.includes('driverAdapters')) {
      expect(initialize).not.toThrow()
    } else {
      expect(initialize).toThrowErrorMatchingInlineSnapshot(`
        ""adapter" property can only be provided to PrismaClient constructor when "driverAdapters" preview feature is enabled.
        Read more at https://pris.ly/d/client-constructor"
      `)
    }
  })
}, defaultTestSuiteOptions)
