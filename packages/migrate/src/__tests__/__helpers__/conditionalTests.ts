import { Provider } from '@prisma/driver-adapter-utils'

import driverAdapters, {
  currentDriverAdapterName,
  DriverAdapterName,
  providerOfCurrentDriverAdapter,
} from './driverAdapters'

// We have some tests for providers that are not supported by driver adapters yet.
// TODO: D1 is also a special case as its tests have to be transformed to driver adapter tests.
export type SupportedProviders = Provider | 'mongodb' | 'cockroachdb' | 'sqlserver' | 'd1'

export type Matrix = {
  providers: {
    [K in SupportedProviders]?: boolean
  }
  driverAdapters: {
    [K in DriverAdapterName]?: boolean
  }
  onlyDriverAdapters?: boolean
}

export const allProviders = {
  mysql: true,
  postgres: true,
  sqlite: true,
  mongodb: true,
  cockroachdb: true,
  sqlserver: true,
  d1: true,
} satisfies Record<SupportedProviders, true>

export const allDriverAdapters = {
  pg: true,
  planetscale: true,
  neon: true,
  libsql: true,
  d1: true,
} satisfies Record<DriverAdapterName, true>

export const sqliteOnly = {
  providers: { sqlite: true },
  driverAdapters: allDriverAdapters,
} satisfies Matrix

export const postgresOnly = {
  providers: { postgres: true },
  driverAdapters: allDriverAdapters,
} satisfies Matrix

export const noDriverAdapters = {
  providers: allProviders,
  driverAdapters: {},
} satisfies Matrix

export const cockroachdbOnly = {
  providers: { cockroachdb: true },
  driverAdapters: {},
} satisfies Matrix

export const sqlServerOnly = {
  providers: { sqlserver: true },
  driverAdapters: {},
} satisfies Matrix

export const mongodbOnly = {
  providers: { mongodb: true },
  driverAdapters: {},
} satisfies Matrix

export const mysqlOnly = {
  providers: { mysql: true },
  driverAdapters: {},
} satisfies Matrix

/**
 * Drop in replacement for `describe` that executes only if the given matrix condition is true.
 * This is mostly to exclude tests from for specific driver adapters.
 * Tests for the legacy schema engine run against all providers at once by default except if
 * certain `TEST_SKIP_` env vars are set.
 *
 * Use `PRISMA_MIGRATE_TEST_ADAPTER` env var to set which driver adapter is used for testing.
 * E.g.: `PRISMA_MIGRATE_TEST_ADAPTER=libsql pnpm test`
 *
 * There are various shorthands for the matrix:
 * - `sqliteOnly`
 * - `postgresOnly`
 * - `noDriverAdapters`
 * - `cockroachdbOnly`
 * - `sqlServerOnly`
 * - `mongodbOnly`
 *
 * More fine granular can be specified per use-case:
 *
 * Examples:
 * ```ts
 * describeMatrix(
 *   { providers: allProviders, driverAdapters: allDriverAdapters },
 *   'test will run with all driver adapters and providers',
 *   () => {...},
 * )
 *
 * describeMatrix(
 *   { providers: { ...allProviders, cockroachdb: false }, driverAdapters: allDriverAdapters },
 *   'test will run with all driver adapters and all providers except cockroachdb',
 *   () => {...},
 * )
 *
 * describeMatrix(
 *   { providers: { cockroachdb: true }, driverAdapters: {} },
 *   'test will run only with cockroachdb and no driver adapters',
 *   () => {...},
 * )
 *
 * describeMatrix(
 *   { providers: allProviders, driverAdapters: allDriverAdapters, onlyDriverAdapters: true },
 *   'test will run only with all driver adapters and providers but not for the legacy schema engine',
 *   () => {...},
 * )
 * ```
 */
export function describeMatrix(matrix: Matrix, name: string, fn: jest.EmptyFunction) {
  // Skip tests for certain providers based on test skip env vars (e.g. used during win & mac CI tests)
  if (matrix.providers.cockroachdb && process.env.TEST_SKIP_COCKROACHDB) return skip(name)
  if (matrix.providers.sqlserver && process.env.TEST_SKIP_MSSQL) return skip(name)
  if (matrix.providers.mongodb && process.env.TEST_SKIP_MONGODB) return skip(name)

  const adapterName = currentDriverAdapterName()

  if (adapterName) {
    // Skip tests that shall not run for a specific driver adapter
    if (!matrix.driverAdapters[adapterName]) return skip(name)
    const provider = providerOfCurrentDriverAdapter()
    // Skip tests that shall not run for driver adapters using a specific provider
    if (!matrix.providers[provider]) return skip(name)
  }

  // Skip tests that shall not run for driver adapters if no driver adapter is used
  if (matrix.onlyDriverAdapters && !adapterName) return skip(name)

  // eslint-disable-next-line jest/valid-describe-callback
  describe(name, fn)
}

// Jest does not allow test files without a single describe+it statement.
// => We work around this by adding a dummy describe+it statement.
function skip(name: string) {
  describe(' SKIPPED - ' + name, () => {
    it('is skipped due to test matrix setup', () => {
      expect(true).toBe(true)
    })
  })
}
