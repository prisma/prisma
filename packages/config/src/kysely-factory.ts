import { loadRefractConfig } from './config-loader.js'
import { type DatabaseProvider, PROVIDER_URL_PATTERNS } from './constants.js'
import { createKyselyDialect } from './dialect-factory.js'
import type { ConfigLoadOptions, KyselyResult } from './types.js'

/**
 * Create a fully configured Kysely instance from Refract configuration
 * This is the main high-level function that combines config loading and Kysely creation
 */
export async function createKyselyFromConfig(options: ConfigLoadOptions = {}): Promise<KyselyResult> {
  // Load configuration with priority resolution
  const { config, configPath, configDir } = await loadRefractConfig(options)

  // Create dialect from config
  const dialect = await createKyselyDialect(config)

  // Create Kysely instance
  const { Kysely } = await import('kysely')
  const kysely = new Kysely<any>({ dialect })

  return {
    kysely,
    config,
    configPath,
    configDir,
  }
}

/**
 * Convenience function to create Kysely with just a connection URL
 * Automatically detects provider from URL
 */
export async function createKyselyFromUrl(url: string): Promise<KyselyResult> {
  const provider = detectProviderFromUrl(url)

  const config = {
    datasource: { provider, url },
    schema: './schema.prisma',
  }

  return createKyselyFromConfig({ config })
}

/**
 * Detect database provider from connection string using centralized patterns
 */
function detectProviderFromUrl(url: string): DatabaseProvider {
  // Check all provider patterns
  for (const [provider, pattern] of Object.entries(PROVIDER_URL_PATTERNS)) {
    if (pattern(url)) {
      return provider as DatabaseProvider
    }
  }

  throw new Error(
    `Unable to detect provider from URL: ${url}. ` +
      'Supported formats: postgresql://, postgres://, mysql://, file:, d1://',
  )
}
