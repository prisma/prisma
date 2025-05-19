import { Provider } from '@prisma/driver-adapter-utils'

import { currentDriverAdapterName, currentProvider, DriverAdapterName } from './driverAdapters'

export type Matrix = Partial<
  Record<Provider | DriverAdapterName | 'mongodb' | 'cockroachdb' | 'sqlserver' | 'driverAdapter', boolean>
>

/**
 * Drop in replacement for `describe` that executes only if the given matrix condition is true.
 *
 * Mostly used to run tests specific to a particular database dialect only with driver adapters who support it.
 * The test suite without driver adapters executes test from all providers at once using the legacy schema engine.
 * To skip tests for all driver adapters, use `driverAdapter: false`.
 * To skip tests for the legacy schema engine, use `driverAdapter: true`.
 *
 * Examples:
 * - describeOnly({ sqlite: true }, "test will run only with all SQLite driver adapters and the legacy schema engine", () => { ... })
 * - describeOnly({ driverAdapter: true }, "test will only run with driver adapters", () => { ... })
 * - describeOnly({ driverAdapter: false }, "test will only run on the legacy schema engine", () => { ... })
 * - describeOnly({ libsql: true }, "test will only run with libsql driver adapter", () => { ... })
 */
export function describeOnly(matrix: Matrix, name: string, fn: jest.EmptyFunction) {
  // Skip tests for certain providers based on test skip env vars (e.g. used during win & mac CI tests)
  if (matrix.cockroachdb && process.env.TEST_SKIP_COCKROACHDB) return skip(name)
  if (matrix.sqlserver && process.env.TEST_SKIP_MSSQL) return skip(name)
  if (matrix.mongodb && process.env.TEST_SKIP_MONGODB) return skip(name)

  const adapterName = currentDriverAdapterName()
  const provider = currentProvider()
  // Skip tests that shall not run for any driver adapter if a driver adapter is used
  if (adapterName && matrix.driverAdapter === false) return skip(name)
  // Skip tests that shall run only for driver adapters if none is used
  if (adapterName === undefined && matrix.driverAdapter === true) return skip(name)

  if (adapterName === undefined || matrix[adapterName] || (provider && matrix[provider])) {
    // eslint-disable-next-line jest/valid-describe-callback
    describe(name, fn)
  } else {
    skip(name)
  }
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
