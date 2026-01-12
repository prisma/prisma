import { type ConfigLoadOptions, createKyselyDialect, loadOrkConfig } from '@ork/config'

import type { OrkClientOptions } from './client.js'
import { OrkClientBase } from './client.js'

/**
 * Convenience factory to create OrkClient from configuration
 * Combines config loading, dialect creation, and client instantiation
 */
export async function createOrkClientFromConfig(
  configOptions: ConfigLoadOptions = {},
  clientOptions: OrkClientOptions<any> = {},
): Promise<OrkClientBase> {
  // Load config and create dialect
  const { config } = await loadOrkConfig(configOptions)
  const dialect = await createKyselyDialect(config)

  // Create client with the dialect
  return new OrkClientBase(dialect, clientOptions)
}
