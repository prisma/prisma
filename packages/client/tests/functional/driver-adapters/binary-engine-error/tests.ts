// @ts-ignore
import type { PrismaClient } from '@prisma/client'
import { ClientEngineType } from '@prisma/internals'

import type { NewPrismaClient } from '../../_utils/types'
import { defaultTestSuiteOptions } from '../_utils/test-suite-options'
import testMatrix from './_matrix'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  ({ engineType }) => {
    testIf(engineType === ClientEngineType.Binary)('throws if trying to use adapter with binary engine', () => {
      expect(() => {
        newPrismaClient({
          // @ts-expect-error
          adapter: {},
        })
      }).toThrowErrorMatchingInlineSnapshot(`
          Cannot use a driver adapter with the "binary" Query Engine. Please use the "library" Query Engine.
          Read more at https://pris.ly/d/client-constructor
        `)
    })
  },
  {
    ...defaultTestSuiteOptions,
    skipDb: true,
  },
)
