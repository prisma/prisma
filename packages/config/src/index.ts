/**
 * @ork/config - Shared configuration and Kysely instance management
 *
 * This package centralizes:
 * 1. Configuration loading with priority resolution
 * 2. Kysely dialect creation for all supported providers
 * 3. Kysely instance creation and management
 *
 * Priority order for configuration loading:
 * 1. Explicit config parameter (highest)
 * 2. Explicit configFile parameter
 * 3. ork.config.ts/js/mjs
 * 4. .config/ork.ts/js/mjs (lowest)
 */

// Type definitions
export type { ConfigLoadOptions, ConfigLoadResult, KyselyResult, OrkConfig } from './types.js'
export { OrkConfigSchema } from './types.js'

// Configuration helper
export { defineConfig } from './define-config.js'

// Constants
export { type DatabaseProvider, PROVIDER_METADATA, PROVIDER_URL_PATTERNS, SUPPORTED_PROVIDERS } from './constants.js'

// Configuration loading
export { findSchemaFile, getDefaultOutputDir, loadOrkConfig } from './config-loader.js'

// Dialect creation
export { createKyselyDialect, validateConnection } from './dialect-factory.js'

// High-level Kysely creation (main API)
export { createKyselyFromConfig, createKyselyFromUrl } from './kysely-factory.js'
