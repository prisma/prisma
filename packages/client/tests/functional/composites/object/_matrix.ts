import { defineMatrix } from '../../_utils/defineMatrix'

const testMatrix = defineMatrix(() => [
  [
    {
      provider: 'mongodb',
    },
  ],
  [
    {
      contentProperty: 'required',
    },

    {
      contentProperty: 'optional',
    },
  ],
])

export const setupTestSuite: typeof testMatrix['setupTestSuite'] = (tests, options) => {
  testMatrix.setupTestSuite(tests, {
    ...options,
    optOut: {
      from: ['sqlite', 'postgresql', 'mysql', 'cockroachdb', 'sqlserver'],
      reason: 'composites are mongo-specific feature',
    },
  })
}

export default testMatrix
