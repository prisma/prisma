import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createDevConnection, sanitizeErrorMessage } from '../managementApi'

const mockFetch = vi.fn()
const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = mockFetch
  vi.stubEnv('PRISMA_MANAGEMENT_API_URL', 'https://api.test.prisma.io')
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.unstubAllEnvs()
  mockFetch.mockReset()
})

describe('createDevConnection', () => {
  test('creates a connection and returns direct connection string', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            id: 'conn_123',
            name: 'dev-test-machine',
            endpoints: {
              pooled: { connectionString: 'postgres://pooled-url' },
              direct: { connectionString: 'postgres://direct-url' },
            },
          },
        }),
    })

    const result = await createDevConnection({
      apiKey: 'test_api_key',
      databaseId: 'db_abc123',
    })

    expect(result.connectionString).toBe('postgres://direct-url')
    expect(mockFetch).toHaveBeenCalledTimes(1)

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/v1/databases/db_abc123/connections')
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe('Bearer test_api_key')
  })

  test('falls back to pooled when direct is not available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            id: 'conn_123',
            name: 'dev-test-machine',
            endpoints: {
              pooled: { connectionString: 'postgres://pooled-url' },
            },
          },
        }),
    })

    const result = await createDevConnection({
      apiKey: 'test_api_key',
      databaseId: 'db_abc123',
    })

    expect(result.connectionString).toBe('postgres://pooled-url')
  })

  test('throws LinkApiError when no connection string in response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            id: 'conn_123',
            name: 'dev-test-machine',
            endpoints: {},
          },
        }),
    })

    await expect(createDevConnection({ apiKey: 'test_api_key', databaseId: 'db_abc123' })).rejects.toThrow(
      /No connection string found/,
    )
  })

  test('throws LinkApiError on 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    })

    await expect(createDevConnection({ apiKey: 'bad_key', databaseId: 'db_abc123' })).rejects.toThrow(/Invalid API key/)
  })

  test('throws LinkApiError on 404', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not Found'),
    })

    await expect(createDevConnection({ apiKey: 'test_api_key', databaseId: 'db_nonexistent' })).rejects.toThrow(
      /not found/,
    )
  })

  test('throws LinkApiError on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    await expect(createDevConnection({ apiKey: 'test_api_key', databaseId: 'db_abc123' })).rejects.toThrow(
      /Could not reach the Management API/,
    )
  })
})

describe('sanitizeErrorMessage', () => {
  test('redacts postgres connection strings', () => {
    const message = 'Failed: postgres://user:pass@host:5432/db'
    expect(sanitizeErrorMessage(message)).not.toContain('user:pass')
    expect(sanitizeErrorMessage(message)).toContain('[REDACTED_URL]')
  })

  test('redacts prisma+postgres connection strings', () => {
    const message = 'URL: prisma+postgres://accelerate.prisma-data.net/?api_key=abc'
    expect(sanitizeErrorMessage(message)).toContain('[REDACTED_URL]')
  })

  test('redacts unquoted --api-key values', () => {
    const message = 'Error with --api-key some_test_token_value flag'
    const sanitized = sanitizeErrorMessage(message)
    expect(sanitized).toContain('--api-key [REDACTED]')
    expect(sanitized).not.toContain('some_test_token_value')
  })
})
