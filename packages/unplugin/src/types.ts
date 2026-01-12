/**
 * Core types for unplugin-ork
 */

export interface OrkPluginOptions {
  /**
   * Path to schema.prisma file (default: './schema.prisma')
   */
  schema?: string

  /**
   * Directory for generated types (default: './.ork')
   */
  outputDir?: string

  /**
   * Watch for schema changes and regenerate types (default: true in dev)
   */
  watch?: boolean

  /**
   * Enable debug logging (default: false)
   */
  debug?: boolean

  /**
   * Disable all output (default: false)
   */
  silent?: boolean

  /**
   * Preserve terminal output instead of clearing on regeneration
   */
  preserveLogs?: boolean

  /**
   * Automatically write the generated client to disk (default: true)
   */
  autoGenerateClient?: boolean

  /**
   * Automatically apply migrations on schema change (default: false)
   */
  autoMigrate?: boolean

  /**
   * Migration safety mode (default: 'safe')
   * - safe: skip destructive changes
   * - force: apply destructive changes
   */
  autoMigrateMode?: 'safe' | 'force'

  /**
   * Optional hook fired after schema changes are processed
   */
  onSchemaChange?: (info: SchemaChangeInfo) => void

  /**
   * Project root directory (default: process.cwd())
   */
  root?: string

  /**
   * Production build configuration
   */
  production?: ProductionBuildOptions
}

export interface SchemaChangeInfo {
  reason: string
  schemaPath: string
  generatedClient: boolean
  migrated: boolean
  migrationSkippedReason?: string
  errors?: string[]
}

export interface ProductionBuildOptions {
  /**
   * Enable production optimizations (default: true in production)
   */
  optimize?: boolean

  /**
   * Enable build caching for faster subsequent builds (default: true)
   */
  cache?: boolean

  /**
   * Cache directory (default: 'node_modules/.cache/unplugin-ork')
   */
  cacheDir?: string

  /**
   * Fail build on schema errors (default: true in production)
   */
  failOnError?: boolean

  /**
   * Generate source maps for virtual modules (default: false)
   */
  sourceMaps?: boolean
}

export interface VirtualModule {
  /** Virtual module ID */
  id: string
  /** Module content */
  content: string
  /** Last modified timestamp */
  lastModified: number
}

export interface SchemaWatchEvent {
  /** Event type */
  type: 'add' | 'change' | 'unlink'
  /** File path that changed */
  path: string
  /** Timestamp of change */
  timestamp: number
}

export interface GeneratedTypes {
  /** TypeScript interface definitions */
  interfaces: string
  /** Database schema types */
  schema: string
  /** Module augmentation for OrkClient */
  augmentation: string
}

export interface GeneratedClientCode {
  /** Complete generated client code with embedded operations */
  clientCode: string
  /** TypeScript declarations for the generated client */
  declarations: string
  /** Database dialect used for generation */
  dialect: string
}

export interface BuildCache {
  /** Schema content hash for cache invalidation */
  schemaHash: string
  /** Generated types cache */
  generatedTypes: GeneratedTypes
  /** Build timestamp */
  timestamp: number
  /** Plugin version for cache invalidation */
  version: string
}

export interface BuildContext {
  /** Whether this is a production build */
  isProduction: boolean
  /** Whether this is a development build with HMR */
  isDevelopment: boolean
  /** Build mode (development/production) */
  mode: 'development' | 'production'
  /** Bundler being used */
  bundler?: 'vite' | 'webpack' | 'rollup' | 'esbuild'
}
