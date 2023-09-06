import { ProviderFlavors } from '../../_utils/providerFlavors'
import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(({ provider, providerFlavor }) => {
  test('int overflow', async () => {
    const promise = prisma.resource.create({
      data: {
        number: 2265000000,
      },
    })

    // TODO: stack trace is not able to locate this error via dataproxy
    if (!process.env.TEST_DATA_PROXY) {
      if (provider === Providers.SQLITE) {
        await expect(promise).rejects.toThrow(
          `Inconsistent column data: Conversion failed: Value 2265000000 does not fit in an INT column, try migrating the 'number' column type to BIGINT`,
        )
      } else if (provider === Providers.POSTGRESQL || provider === Providers.COCKROACHDB) {
        await expect(promise).rejects.toThrow(
          `Unable to fit integer value '2265000000' into an INT4 (32-bit signed integer).`,
        )
      } else if (providerFlavor === ProviderFlavors.VITESS_8 || providerFlavor === ProviderFlavors.JS_PLANETSCALE) {
        await expect(promise).rejects.toThrow(
          `code = FailedPrecondition desc = Out of range value for column 'number' at row 1 (errno 1264) (sqlstate 22003)`,
        )
      } else if (provider === Providers.MYSQL) {
        await expect(promise).rejects.toThrow(
          `Value out of range for the type. Out of range value for column 'number' at row 1`,
        )
      } else if (provider === Providers.SQLSERVER) {
        await expect(promise).rejects.toThrow(`Arithmetic overflow error converting expression to data type int.`)
      } else if (provider === Providers.MONGODB) {
        // It does not fail on MongoDB
        await expect(promise).resolves.toMatchObject({
          number: 2265000000,
        })
      } else {
        throw new Error(`TODO add error for provider ${provider}`)
      }
    }
  })
})
