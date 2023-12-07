import { defineMatrix } from '../../_utils/defineMatrix'
import { Providers } from '../../_utils/providers'

const testMatrix = defineMatrix(() => [
  [
    {
      provider: Providers.MONGODB,
    },
  ],
])

export const setupTestSuite: (typeof testMatrix)['setupTestSuite'] = (tests, options) => {
  testMatrix.setupTestSuite(tests, {
    ...options,
    optOut: {
      from: ['sqlite', 'postgresql', 'mysql', 'cockroachdb', 'sqlserver'],
      reason: 'composites are mongo-specific feature',
    },
  })
}

export default testMatrix
