import { DriverAdapter } from '@prisma/driver-adapter-utils'

import { Providers as Provider } from '../../_utils/providers'
import { flavourFromProvider } from './flavour'

export const mockAdapterErrors = {
  queryRaw: new Error('Not implemented: queryRaw'),
  executeRaw: new Error('Not implemented: executeRaw'),
  startTransaction: new Error('Not implemented: startTransaction'),
  close: new Error('Not implemented: close'),
}

/**
 * Create an adapter stub for testing.
 */
export function mockAdapter(provider: Provider): DriverAdapter {
  return {
    flavour: flavourFromProvider(provider),
    queryRaw: () => Promise.reject(mockAdapterErrors.queryRaw),
    executeRaw: () => Promise.reject(mockAdapterErrors.executeRaw),
    startTransaction: () => Promise.reject(mockAdapterErrors.startTransaction),
    close: () => Promise.reject(mockAdapterErrors.close),
  }
}
