import { ClientEngineType } from '@prisma/internals'

import { NewPrismaClient } from '../../_utils/types'
import { defaultTestSuiteOptions } from '../_utils/test-suite-options'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare const newPrismaClient: NewPrismaClient<PrismaClient, typeof PrismaClient>

testMatrix.setupTestSuite(
  ({ engineType }) => {
    testIf(engineType === ClientEngineType.Binary)('throws if trying to use adapter with binary engine', () => {
      expect(() => {
        newPrismaClient({
          // @ts-expect-error
          driver: {},
        })
      }).toThrowErrorMatchingInlineSnapshot(`
          Cannot use a driver with the "binary" Query Engine. Please use the "library" Query Engine.
          Read more at https://pris.ly/d/client-constructor
        `)
    })
  },
  {
    ...defaultTestSuiteOptions,
    skipDb: true,
  },
)
