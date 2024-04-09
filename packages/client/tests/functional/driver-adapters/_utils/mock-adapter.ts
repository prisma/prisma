import { DriverAdapter } from '@prisma/driver-adapter-utils'

import { Providers as Provider } from '../../_utils/providers'
import { getDriverAdaptersProvider } from './provider'

export const mockAdapterErrors = {
  queryRaw: new Error('Not implemented: queryRaw'),
  executeRaw: new Error('Not implemented: executeRaw'),
  startTransaction: new Error('Not implemented: startTransaction'),
}

/**
 * Create an adapter stub for testing.
 */
export function mockAdapter(provider: Provider): DriverAdapter {
  return {
    provider: getDriverAdaptersProvider(provider),
    // TODO: this should be the package name to be exact, but it's not used in the tests yet
    adapterName: `mock-adapter-${getDriverAdaptersProvider(provider)}`,
    queryRaw: () => Promise.reject(mockAdapterErrors.queryRaw),
    executeRaw: () => Promise.reject(mockAdapterErrors.executeRaw),
    startTransaction: () => Promise.reject(mockAdapterErrors.startTransaction),
  }
}
