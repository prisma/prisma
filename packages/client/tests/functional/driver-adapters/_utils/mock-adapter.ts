import { DriverAdapter } from '@prisma/driver-adapter-utils'

import { Providers as Provider } from '../../_utils/providers'
import { getDriverAdaptersProvider } from './provider'

export const mockAdapterErrors = {
  queryRaw: new Error('Not implemented: queryRaw'),
  executeRaw: new Error('Not implemented: executeRaw'),
  transactionContext: new Error('Not implemented: transactionContext'),
}

/**
 * Create an adapter stub for testing.
 */
export function mockAdapter(provider: Provider): DriverAdapter {
  return {
    provider: getDriverAdaptersProvider(provider),
    adapterName: getDriverAdaptersProvider(provider),
    queryRaw: () => Promise.reject(mockAdapterErrors.queryRaw),
    executeRaw: () => Promise.reject(mockAdapterErrors.executeRaw),
    transactionContext: () => Promise.reject(mockAdapterErrors.transactionContext),
  }
}
