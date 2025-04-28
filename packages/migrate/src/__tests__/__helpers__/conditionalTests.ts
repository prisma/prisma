import { Provider } from '@prisma/driver-adapter-utils'

import { currentDriverAdapterName, currentProvider, DriverAdapterName } from './driverAdapters'

export type Matrix = Partial<
  Record<Provider | DriverAdapterName | 'mongodb' | 'cockroachdb' | 'sqlserver' | 'driverAdapter', boolean>
>

export function describeOnly(matrix: Matrix, name: string, fn: jest.EmptyFunction) {
  if (matrix.cockroachdb && process.env.TEST_SKIP_COCKROACH) return skip(name)
  if (matrix.sqlserver && process.env.TEST_SKIP_MSSQL) return skip(name)
  if (matrix.mongodb && process.env.TEST_SKIP_MONGODB) return skip(name)

  const adapterName = currentDriverAdapterName()
  const provider = currentProvider()
  if (adapterName && matrix.driverAdapter === false) return skip(name)
  if (adapterName === undefined && matrix.driverAdapter === true) return skip(name)
  if (
    adapterName === undefined ||
    matrix[adapterName] ||
    (provider && matrix[provider]) ||
    (adapterName !== undefined && matrix.driverAdapter === true)
  ) {
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
