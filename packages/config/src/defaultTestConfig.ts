import { PrismaConfig } from './PrismaConfig'

/**
 * This default config can be used as basis for unit and integration tests.
 */
export function defaultTestConfig(): PrismaConfig {
  return {
    experimental: true,
    loadedFrom: null,
  }
}
