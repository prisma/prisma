import { NewPrismaClient } from '../../_utils/types'
import { defaultTestSuiteOptions } from '../_utils/test-suite-options'
import testMatrix from './_matrix'
// @ts-ignore
import { PrismaClient } from './generated/prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(({ clientRuntime, engineType }, _suiteMeta, clientMeta) => {
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  let prisma: PrismaClient | undefined

  afterEach(async () => {
    await prisma?.$disconnect()
  })

  test('does not throw without the adapter property', () => {
    expect(() => (prisma = newPrismaClient())).not.toThrow()
  })

  // TODO: Fails with PrismaClientValidationError: Invalid client engine type, please use `library` or `binary`
  skipTestIf(clientRuntime === 'wasm')('does not throw if adapter is set to null', async () => {
    prisma = newPrismaClient({ adapter: null })

    if (!clientMeta.driverAdapter) {
      await prisma.user.findMany()
    }
  })

  skipTestIf(engineType === 'client')('throws if adapter is explicitly set to undefined', () => {
    expect(() => (prisma = newPrismaClient({ adapter: undefined }))).toThrowErrorMatchingInlineSnapshot(`
      ""adapter" property must not be undefined, use null to conditionally disable driver adapters.
      Read more at https://pris.ly/d/client-constructor"
    `)
  })

  skipTestIf(engineType !== 'client')('throws if adapter is explicitly set to undefined', () => {
    expect(() => (prisma = newPrismaClient({ adapter: undefined }))).toThrowErrorMatchingInlineSnapshot(`
      "Using engine type "client" requires a driver adapter to be provided to PrismaClient constructor.
      Read more at https://pris.ly/d/client-constructor"
    `)
  })
}, defaultTestSuiteOptions)
