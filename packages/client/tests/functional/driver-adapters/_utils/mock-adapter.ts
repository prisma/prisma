import { DriverAdapter } from '@prisma/driver-adapter-utils'

import { Providers as Provider } from '../../_utils/providers'
import { flavourFromProvider } from './flavour'

/**
 * Create an adapter stub for testing.
 */
export function mockAdapter(provider: Provider): DriverAdapter {
  return {
    flavour: flavourFromProvider(provider),
    queryRaw: () => Promise.reject(new Error('not implemented')),
    executeRaw: () => Promise.reject(new Error('not implemented')),
    startTransaction: () => Promise.reject(new Error('not implemented')),
    close: () => Promise.reject(new Error('not implemented')),
  }
}
