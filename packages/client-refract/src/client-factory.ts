import { type ConfigLoadOptions, createKyselyDialect, loadRefractConfig } from '@refract/config'

import type { RefractClientOptions } from './client.js'
import { RefractClientBase } from './client.js'

/**
 * Convenience factory to create RefractClient from configuration
 * Combines config loading, dialect creation, and client instantiation
 */
export async function createRefractClientFromConfig(
  configOptions: ConfigLoadOptions = {},
  clientOptions: RefractClientOptions<any> = {},
): Promise<RefractClientBase> {
  // Load config and create dialect
  const { config } = await loadRefractConfig(configOptions)
  const dialect = await createKyselyDialect(config)

  // Create client with the dialect
  return new RefractClientBase(dialect, clientOptions)
}
