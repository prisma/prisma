import type { DriverAdapter } from '@prisma/driver-adapter-utils'

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
export function mockAdapter(provider: 'mysql' | 'sqlite' | 'postgres'): DriverAdapter {
  return {
    provider,
    adapterName: '@prisma/adapter-mock',
    queryRaw: () => Promise.reject(mockAdapterErrors.queryRaw),
    executeRaw: () => Promise.reject(mockAdapterErrors.executeRaw),
    transactionContext: () => Promise.reject(mockAdapterErrors.transactionContext),
    executeScript: () => Promise.reject(mockAdapterErrors.executeScript),
    dispose: () => Promise.reject(mockAdapterErrors.dispose),
  }
}
