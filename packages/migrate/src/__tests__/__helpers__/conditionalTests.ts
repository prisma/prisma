import { Provider } from '@prisma/driver-adapter-utils'

import { currentDriverAdapterName, currentProvider, DriverAdapterName } from './driverAdapters'

export type Matrix = Partial<Record<Provider | DriverAdapterName | 'mongodb' | 'cockroachdb' | 'sqlserver', boolean>>

export function describeOnly(matrix: Matrix, name: string, fn: jest.EmptyFunction) {
  if (matrix.cockroachdb && process.env.TEST_SKIP_COCKROACH) return
  if (matrix.sqlserver && process.env.TEST_SKIP_MSSQL) return
  if (matrix.mongodb && process.env.TEST_SKIP_MONGODB) return

  const adapterName = currentDriverAdapterName()
  const provider = currentProvider()
  if (adapterName === undefined || matrix[adapterName] || (provider && matrix[provider])) {
    // eslint-disable-next-line jest/valid-describe-callback
    describe(name, fn)
  }
}
