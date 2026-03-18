import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createDevConnection, LinkApiError, sanitizeErrorMessage } from '../managementApi'

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
  test('creates a new connection when none exists', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: 'conn_123',
              name: 'dev-test-machine',
              endpoints: {
                pooled: { connectionString: 'prisma+postgres://pooled-url' },
                direct: { connectionString: 'postgres://direct-url' },
              },
            },
          }),
      })

    const result = await createDevConnection({
      apiKey: 'test_api_key',
      databaseId: 'db_abc123',
    })

    expect(result.connectionString).toBe('prisma+postgres://pooled-url')
    expect(result.directConnectionString).toBe('postgres://direct-url')

    expect(mockFetch).toHaveBeenCalledTimes(2)
    const [listUrl, listOpts] = mockFetch.mock.calls[0]
    expect(listUrl).toContain('/v1/databases/db_abc123/connections')
    expect(listOpts.headers.Authorization).toBe('Bearer test_api_key')

    const [createUrl, createOpts] = mockFetch.mock.calls[1]
    expect(createUrl).toContain('/v1/databases/db_abc123/connections')
    expect(createOpts.method).toBe('POST')
  })

  test('reuses an existing connection with the same name', async () => {
    const hostname = (await import('node:os')).hostname()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              id: 'conn_existing',
              name: `dev-${hostname}`,
              endpoints: {
                pooled: { connectionString: 'prisma+postgres://existing-pooled' },
                direct: { connectionString: 'postgres://existing-direct' },
              },
            },
          ],
        }),
    })

    const result = await createDevConnection({
      apiKey: 'test_api_key',
      databaseId: 'db_abc123',
    })

    expect(result.connectionString).toBe('prisma+postgres://existing-pooled')
    expect(result.directConnectionString).toBe('postgres://existing-direct')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test('throws LinkApiError on 401', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      })

    await expect(createDevConnection({ apiKey: 'bad_key', databaseId: 'db_abc123' })).rejects.toThrow(/Invalid API key/)
  })

  test('throws LinkApiError on 404', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      })

    await expect(createDevConnection({ apiKey: 'test_api_key', databaseId: 'db_nonexistent' })).rejects.toThrow(
      /not found/,
    )
  })

  test('throws LinkApiError on network failure', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))

    await expect(createDevConnection({ apiKey: 'test_api_key', databaseId: 'db_abc123' })).rejects.toThrow(LinkApiError)
  })

  test('propagates 401 from list connections immediately', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    })

    await expect(createDevConnection({ apiKey: 'bad_key', databaseId: 'db_abc123' })).rejects.toThrow(/Invalid API key/)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test('propagates 403 from list connections immediately', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
    })

    await expect(createDevConnection({ apiKey: 'test_api_key', databaseId: 'db_abc123' })).rejects.toThrow(
      /Access denied/,
    )
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test('throws on network failure during list connections', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    await expect(createDevConnection({ apiKey: 'test_api_key', databaseId: 'db_abc123' })).rejects.toThrow(
      /Could not reach the Management API/,
    )
    expect(mockFetch).toHaveBeenCalledTimes(1)
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
