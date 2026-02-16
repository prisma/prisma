/**
 * Utilities for handling Prisma Postgres local dev instance URLs.
 *
 * Local Prisma Postgres instances (started via `prisma dev`) use URLs in the format:
 * `prisma+postgres://localhost:PORT/?api_key=BASE64_JSON`
 *
 * The api_key parameter contains a base64-encoded JSON object with the actual
 * PostgreSQL connection details that should be used with the pg driver.
 *
 * @remarks
 * When to use which adapter for Prisma Postgres:
 * - Local dev instances (`npx prisma dev`) → Use `@prisma/adapter-pg` (this package)
 * - Remote serverless instances → Use `@prisma/adapter-ppg`
 *
 * This package automatically handles the URL conversion for local dev instances,
 * so you can pass the connection string from `prisma dev` directly to the adapter.
 */

const PRISMA_POSTGRES_PROTOCOL = 'prisma+postgres:'

interface PrismaPostgresDevApiKey {
  databaseUrl: string
  name: string
  shadowDatabaseUrl: string
}

/**
 * Type guard to validate that a decoded object matches PrismaPostgresDevApiKey structure.
 */
function isPrismaPostgresDevApiKey(obj: unknown): obj is PrismaPostgresDevApiKey {
  if (typeof obj !== 'object' || obj === null) {
    return false
  }

  const candidate = obj as Record<string, unknown>
  return (
    typeof candidate.databaseUrl === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.shadowDatabaseUrl === 'string'
  )
}

/**
 * Checks if a URL is a Prisma Postgres local dev instance URL.
 */
export function isPrismaPostgresLocalDevUrl(connectionString: string | URL): boolean {
  try {
    const url = typeof connectionString === 'string' ? new URL(connectionString) : connectionString
    if (url.protocol !== PRISMA_POSTGRES_PROTOCOL) {
      return false
    }

    const { hostname } = url
    // Note: URL parser normalizes [0:0:0:0:0:0:0:1] to [::1], so we only need to check the normalized form
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  } catch {
    return false
  }
}

/**
 * Extracts the actual PostgreSQL database URL from a Prisma Postgres local dev URL.
 *
 * @param connectionString The prisma+postgres://localhost URL
 * @returns The actual postgres:// URL to use for connections
 * @throws Error if the URL is invalid or the api_key cannot be decoded
 */
export function extractDatabaseUrl(connectionString: string | URL): string {
  const url = typeof connectionString === 'string' ? new URL(connectionString) : connectionString

  if (!isPrismaPostgresLocalDevUrl(url)) {
    throw new Error(
      `Invalid Prisma Postgres local dev URL. Expected prisma+postgres://localhost, got ${url.protocol}//${url.host}`,
    )
  }

  const apiKey = url.searchParams.get('api_key')
  if (!apiKey) {
    throw new Error('Missing api_key parameter in Prisma Postgres local dev URL')
  }

  let decodedApiKey: unknown
  try {
    const jsonString = Buffer.from(apiKey, 'base64').toString('utf-8')
    decodedApiKey = JSON.parse(jsonString)
  } catch (error) {
    // Buffer.from() doesn't throw on invalid base64, it silently produces garbage.
    // Only JSON.parse() can throw here (always SyntaxError for invalid JSON).
    throw new Error(
      `Invalid api_key format: expected base64-encoded JSON, got ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (!isPrismaPostgresDevApiKey(decodedApiKey)) {
    throw new Error(
      'Invalid api_key structure: expected object with databaseUrl, name, and shadowDatabaseUrl properties',
    )
  }

  return decodedApiKey.databaseUrl
}

/**
 * Converts a connection string to a format suitable for the pg driver.
 *
 * If the connection string is a Prisma Postgres local dev URL, extracts the
 * actual database URL. Otherwise, returns the connection string as-is.
 *
 * @param connectionString The connection string (may be prisma+postgres:// or postgres://)
 * @returns A standard PostgreSQL connection string
 */
export function toPostgresConnectionString(connectionString: string | URL): string {
  const connStr = typeof connectionString === 'string' ? connectionString : connectionString.toString()

  if (isPrismaPostgresLocalDevUrl(connStr)) {
    return extractDatabaseUrl(connStr)
  }

  return connStr
}
