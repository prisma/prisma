import { SqlDriverAdapter, SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils'

export const mockAdapterErrors = {
  queryRaw: new Error('Not implemented: queryRaw'),
  executeRaw: new Error('Not implemented: executeRaw'),
  startTransaction: new Error('Not implemented: startTransaction'),
  executeScript: new Error('Not implemented: executeScript'),
  dispose: new Error('Not implemented: dispose'),
}

/**
 * Create an adapter stub for testing.
 */
export function mockAdapter(provider: 'mysql' | 'sqlite' | 'postgres'): SqlDriverAdapter {
  return {
    provider,
    adapterName: '@prisma/adapter-mock',
    queryRaw: () => Promise.reject(mockAdapterErrors.queryRaw),
    executeRaw: () => Promise.reject(mockAdapterErrors.executeRaw),
    startTransaction: () => Promise.reject(mockAdapterErrors.startTransaction),
    executeScript: () => Promise.reject(mockAdapterErrors.executeScript),
    dispose: () => Promise.reject(mockAdapterErrors.dispose),
  }
}

/**
 * Create an adapter factory stub for testing.
 */
export function mockAdapterFactory(provider: 'mysql' | 'sqlite' | 'postgres'): SqlDriverAdapterFactory {
  return {
    provider,
    adapterName: '@prisma/adapter-mock',
    connect: () => Promise.resolve(mockAdapter(provider)),
  }
}
