import { hostname } from 'node:os'

const DEFAULT_MANAGEMENT_API_URL = 'https://api.prisma.io'

export interface ConnectionResult {
  connectionString: string
  directConnectionString: string | null
}

export class LinkApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message)
    this.name = 'LinkApiError'
  }
}

function getManagementApiUrl(): string {
  return process.env.PRISMA_MANAGEMENT_API_URL ?? DEFAULT_MANAGEMENT_API_URL
}

function getConnectionName(): string {
  return `dev-${hostname()}`
}

export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/postgres(ql)?:\/\/[^\s"']+/gi, '[REDACTED_URL]')
    .replace(/prisma\+postgres:\/\/[^\s"']+/gi, '[REDACTED_URL]')
    .replace(/(--api-key\s+)"[^"]*"/g, '$1"[REDACTED]"')
    .replace(/(--api-key\s+)(\S+)/g, '$1[REDACTED]')
}

interface ListConnectionsResponse {
  data: Array<{
    id: string
    name: string
    connectionString?: string
    endpoints?: {
      direct?: { connectionString: string }
      pooled?: { connectionString: string }
    }
  }>
}

interface CreateConnectionResponse {
  data: {
    id: string
    name: string
    connectionString?: string
    endpoints?: {
      direct?: { connectionString: string }
      pooled?: { connectionString: string }
    }
  }
}

function extractConnectionStrings(connection: {
  connectionString?: string
  endpoints?: {
    direct?: { connectionString: string }
    pooled?: { connectionString: string }
  }
}): ConnectionResult {
  const pooled = connection.endpoints?.pooled?.connectionString
  const direct = connection.endpoints?.direct?.connectionString

  const connectionString = pooled ?? direct ?? connection.connectionString
  if (!connectionString) {
    throw new LinkApiError('No connection string found in API response')
  }

  return {
    connectionString,
    directConnectionString: direct && pooled ? direct : null,
  }
}

async function findExistingConnection(opts: {
  apiKey: string
  databaseId: string
  connectionName: string
}): Promise<ConnectionResult | null> {
  const baseUrl = getManagementApiUrl()
  const url = `${baseUrl}/v1/databases/${opts.databaseId}/connections`

  let res: Response
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${opts.apiKey}` },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new LinkApiError(`Could not reach the Management API at ${baseUrl}: ${sanitizeErrorMessage(message)}`)
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new LinkApiError('Invalid API key — check your key or generate a new one at console.prisma.io.', res.status)
    }
    if (res.status === 403) {
      throw new LinkApiError('Access denied — your API key does not have access to this database.', res.status)
    }
    return null
  }

  const json = (await res.json()) as ListConnectionsResponse
  const existing = json.data?.find((c) => c.name === opts.connectionName)

  if (!existing) {
    return null
  }

  return extractConnectionStrings(existing)
}

export async function createDevConnection(opts: { apiKey: string; databaseId: string }): Promise<ConnectionResult> {
  const connectionName = getConnectionName()

  const existing = await findExistingConnection({
    apiKey: opts.apiKey,
    databaseId: opts.databaseId,
    connectionName,
  })

  if (existing) {
    return existing
  }

  const baseUrl = getManagementApiUrl()
  const url = `${baseUrl}/v1/databases/${opts.databaseId}/connections`

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: connectionName }),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new LinkApiError(`Could not reach the Management API at ${baseUrl}: ${sanitizeErrorMessage(message)}`)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')

    switch (res.status) {
      case 401:
        throw new LinkApiError(
          'Invalid API key — check your key or generate a new one at console.prisma.io.',
          res.status,
        )
      case 404:
        throw new LinkApiError(
          `Database "${opts.databaseId}" not found — check the database ID in your console.`,
          res.status,
        )
      case 429:
        throw new LinkApiError('Rate limited — please try again in a moment.', res.status)
      default:
        throw new LinkApiError(`Management API error (${res.status}): ${sanitizeErrorMessage(body)}`, res.status)
    }
  }

  const json = (await res.json()) as CreateConnectionResponse
  return extractConnectionStrings(json.data)
}
