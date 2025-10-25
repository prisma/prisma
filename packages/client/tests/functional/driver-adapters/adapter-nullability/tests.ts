import { NewPrismaClient } from '../../_utils/types'
import { defaultTestSuiteOptions } from '../_utils/test-suite-options'
import testMatrix from './_matrix'
// @ts-ignore
import { PrismaClient } from './generated/prisma/client'

declare const newPrismaClient: NewPrismaClient<PrismaClient, typeof PrismaClient>

testMatrix.setupTestSuite((_, _suiteMeta) => {
  test('does not throw without the adapter property', () => {
    expect(() => newPrismaClient()).not.toThrow()
  })

  test('throws if adapter is explicitly set to undefined', () => {
    expect(() => newPrismaClient({ adapter: undefined })).toThrowErrorMatchingInlineSnapshot(`
      "Using engine type "client" requires a driver adapter to be provided to PrismaClient constructor.
      Read more at https://pris.ly/d/client-constructor"
    `)
  })
}, defaultTestSuiteOptions)
