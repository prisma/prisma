import type { DriverAdapter } from '@prisma/driver-adapter-utils'

import type { Providers as Provider } from '../../_utils/providers'
import { getDriverAdaptersProvider } from './provider'

export const mockAdapterErrors = {
  queryRaw: new Error('Not implemented: queryRaw'),
  executeRaw: new Error('Not implemented: executeRaw'),
  transactionContext: new Error('Not implemented: transactionContext'),
  executeScript: new Error('Not implemented: executeScript'),
  dispose: new Error('Not implemented: dispose'),
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
    executeScript: () => Promise.reject(mockAdapterErrors.executeScript),
    dispose: () => Promise.reject(mockAdapterErrors.dispose),
  }
}
