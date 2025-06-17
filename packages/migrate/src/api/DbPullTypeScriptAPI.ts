import type { PrismaConfigInternal } from '@prisma/config'

import { DbPullTypeScript } from '../commands/DbPullTypeScript'

/**
 * TypeScript API for database introspection using WASM engines.
 *
 * This provides a clean programmatic interface for the TypeScript-native
 * db pull functionality, suitable for integration into larger applications
 * or automated workflows.
 *
 * @example
 * ```typescript
 * import { introspectDatabase } from '@prisma/migrate/api'
 *
 * // Basic introspection
 * const schema = await introspectDatabase({
 *   config: prismaConfig,
 *   print: true
 * })
 *
 * // With custom options
 * const schema = await introspectDatabase({
 *   config: prismaConfig,
 *   schemaPath: './custom/schema.prisma',
 *   force: true,
 *   compositeTypeDepth: 2
 * })
 * ```
 */

/**
 * Options for database introspection.
 */
export interface IntrospectDatabaseOptions {
  /** Prisma configuration object */
  config: PrismaConfigInternal<any>

  /** Custom path to Prisma schema file */
  schemaPath?: string

  /** Return schema as string instead of writing to file */
  print?: boolean

  /** Ignore current schema and overwrite completely */
  force?: boolean

  /** Database connection URL override */
  url?: string

  /** Depth for introspecting composite types (MongoDB) */
  compositeTypeDepth?: number

  /** Database schemas to introspect (PostgreSQL) */
  schemas?: string[]

  /** Use local Cloudflare D1 database */
  localD1?: boolean
}

/**
 * Result from database introspection.
 */
export interface IntrospectDatabaseResult {
  /** Generated Prisma schema content (if print: true) */
  schema?: string

  /** Success message */
  message: string

  /** Introspection warnings */
  warnings?: string

  /** Models and types found */
  stats: {
    modelsCount: number
    typesCount: number
  }
}

/**
 * Captures stdout and stderr during function execution.
 */
interface CapturedOutput {
  stdout: string
  stderr: string
}

/**
 * Captures stdout and stderr during async function execution.
 */
async function captureStdOutput<T>(fn: () => Promise<T>): Promise<{ result: T; captured: CapturedOutput }> {
  const originalWrite = process.stdout.write.bind(process.stdout)
  const originalErrorWrite = process.stderr.write.bind(process.stderr)

  let stdoutContent = ''
  let stderrContent = ''

  // Override stdout.write
  process.stdout.write = (chunk: any) => {
    stdoutContent += chunk.toString()
    return true
  }

  // Override stderr.write
  process.stderr.write = (chunk: any) => {
    stderrContent += chunk.toString()
    return true
  }

  try {
    const result = await fn()
    return {
      result,
      captured: {
        stdout: stdoutContent,
        stderr: stderrContent,
      },
    }
  } finally {
    // Restore original functions
    process.stdout.write = originalWrite
    process.stderr.write = originalErrorWrite
  }
}

/**
 * Parses introspection statistics from output message.
 */
function parseIntrospectionStats(output: string): { modelsCount: number; typesCount: number } {
  // Look for patterns like "Introspected 3 models" or "Introspected 2 models and 1 embedded document"
  const modelsMatch = output.match(/Introspected (\d+) models?/)
  const typesMatch = output.match(/and (\d+) embedded documents?/)

  return {
    modelsCount: modelsMatch ? parseInt(modelsMatch[1], 10) : 0,
    typesCount: typesMatch ? parseInt(typesMatch[1], 10) : 0,
  }
}

/**
 * Introspects a database and generates Prisma schema using TypeScript-native implementation.
 *
 * This function provides a clean programmatic interface to the db pull functionality
 * without requiring CLI argument parsing or process spawning. It properly captures
 * the command output to provide structured results.
 *
 * @param options - Introspection configuration options
 * @returns Promise resolving to introspection result
 *
 * @throws Error if introspection fails or configuration is invalid
 *
 * @example
 * ```typescript
 * // Generate schema from database
 * const result = await introspectDatabase({
 *   config: await loadConfig(),
 *   print: true
 * })
 *
 * console.log(result.schema) // Generated Prisma schema
 * console.log(result.stats)  // { modelsCount: 3, typesCount: 0 }
 * ```
 */
export async function introspectDatabase(options: IntrospectDatabaseOptions): Promise<IntrospectDatabaseResult> {
  // Build command arguments using the helper function
  const args = buildIntrospectionArgs(options)

  // Execute introspection with output capture
  const pullCommand = new DbPullTypeScript()
  const { captured } = await captureStdOutput(async () => {
    return await pullCommand.parse(args, options.config)
  })

  // Parse the captured output
  const stats = parseIntrospectionStats(captured.stdout)

  // Extract success message
  const successMessageMatch = captured.stdout.match(/✔ Introspected.*/)
  const message = successMessageMatch
    ? successMessageMatch[0].replace(/✔ /, '')
    : 'Introspection completed successfully'

  // Extract warnings from stderr (if any)
  const warnings = captured.stderr.trim() || undefined

  return {
    schema: options.print ? captured.stdout : undefined,
    message,
    warnings,
    stats,
  }
}

/**
 * Validates that the provided configuration supports TypeScript-native introspection.
 *
 * @param config - Prisma configuration to validate
 * @throws Error if configuration is not compatible
 */
export function validateTypeScriptIntrospectionConfig(config: PrismaConfigInternal<any>): void {
  if (!config.migrate?.adapter) {
    throw new Error(`
TypeScript-native introspection requires driver adapters. Please configure an adapter in your Prisma config.

More information: https://pris.ly/d/driver-adapters
`)
  }
}

/**
 * Creates a DbPullTypeScript command instance for advanced usage.
 *
 * This allows direct access to the command implementation for scenarios
 * requiring fine-grained control over the introspection process.
 *
 * @returns New DbPullTypeScript command instance
 *
 * @example
 * ```typescript
 * const command = createDbPullCommand()
 * const help = command.help()
 * const result = await command.parse(['--print'], config)
 * ```
 */
export function createDbPullCommand(): DbPullTypeScript {
  return DbPullTypeScript.new()
}

/**
 * Type-safe argument builder for db pull commands.
 *
 * @example
 * ```typescript
 * const args = buildIntrospectionArgs({
 *   print: true,
 *   force: true,
 *   schemaPath: './schema.prisma'
 * })
 * // ['--print', '--force', '--schema', './schema.prisma']
 * ```
 */
export function buildIntrospectionArgs(options: Partial<IntrospectDatabaseOptions>): string[] {
  const args: string[] = []

  if (options.print) args.push('--print')
  if (options.force) args.push('--force')
  if (options.schemaPath) args.push('--schema', options.schemaPath)
  if (options.url) args.push('--url', options.url)
  if (options.compositeTypeDepth !== undefined) {
    args.push('--composite-type-depth', options.compositeTypeDepth.toString())
  }
  if (options.schemas) args.push('--schemas', options.schemas.join(','))
  if (options.localD1) args.push('--local-d1')

  return args
}

// Re-export the command class for direct usage
export { DbPullTypeScript }
