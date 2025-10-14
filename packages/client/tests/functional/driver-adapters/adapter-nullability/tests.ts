import { NewPrismaClient } from '../../_utils/types'
import { defaultTestSuiteOptions } from '../_utils/test-suite-options'
import testMatrix from './_matrix'
// @ts-ignore
import { PrismaClient } from './generated/prisma/client'

declare const newPrismaClient: NewPrismaClient<PrismaClient, typeof PrismaClient>

testMatrix.setupTestSuite(({ clientRuntime, engineType }, _suiteMeta, clientMeta) => {
  test('does not throw without the adapter property', () => {
    expect(() => newPrismaClient()).not.toThrow()
  })

  // TODO: Fails with PrismaClientValidationError: Invalid client engine type, please use `library` or `binary`
  skipTestIf(
    clientRuntime === 'wasm-engine-edge' || clientRuntime === 'wasm-compiler-edge' || clientRuntime === 'client',
  )('does not throw if adapter is set to null', async () => {
    const prisma = newPrismaClient({ driver: null })

    if (!clientMeta.driverAdapter) {
      await prisma.user.findMany()
    }
  })

  skipTestIf(engineType === 'client')('throws if driver is explicitly set to undefined', () => {
    expect(() => newPrismaClient({ driver: undefined })).toThrowErrorMatchingInlineSnapshot(`
      ""driver" property must not be undefined, use null to conditionally disable drivers.
      Read more at https://pris.ly/d/client-constructor"
    `)
  })

  skipTestIf(engineType !== 'client')('throws if adapter is explicitly set to undefined', () => {
    expect(() => newPrismaClient({ driver: undefined })).toThrowErrorMatchingInlineSnapshot(`
      "Using engine type "client" requires a driver to be provided to PrismaClient constructor.
      Read more at https://pris.ly/d/client-constructor"
    `)
  })
}, defaultTestSuiteOptions)
