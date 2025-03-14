import { SqlDriverAdapter, SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils'

import { Providers as Provider } from '../../_utils/providers'
import { getDriverAdaptersProvider } from './provider'

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
export function mockAdapter(provider: Provider): SqlDriverAdapter {
  return {
    provider: getDriverAdaptersProvider(provider),
    adapterName: getDriverAdaptersProvider(provider),
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
export function mockAdapterFactory(provider: Provider): SqlDriverAdapterFactory {
  return {
    provider: getDriverAdaptersProvider(provider),
    adapterName: getDriverAdaptersProvider(provider),
    connect: () => Promise.resolve(mockAdapter(provider)),
  }
}
