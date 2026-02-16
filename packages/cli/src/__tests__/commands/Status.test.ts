import { stripVTControlCharacters } from 'node:util'

import { defaultTestConfig } from '@prisma/config'

import { Status } from '../../Status'

function makeSummary(overrides: Record<string, unknown> = {}) {
  return {
    status: { indicator: 'none', description: 'All Systems Operational' },
    components: [
      { id: '1', name: 'Prisma Accelerate', status: 'operational', position: 1, group: false, group_id: null, description: null },
      { id: '2', name: 'Prisma Console', status: 'operational', position: 2, group: false, group_id: null, description: null },
      { id: '3', name: 'Prisma Optimize', status: 'operational', position: 3, group: false, group_id: null, description: null },
      { id: '4', name: 'Prisma Postgres', status: 'operational', position: 4, group: false, group_id: null, description: null },
    ],
    incidents: [],
    scheduled_maintenances: [],
    ...overrides,
  }
}

function mockFetchSuccess(data: unknown) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  })
}

function mockFetchHttpError(status: number) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  })
}

function mockFetchNetworkError(message: string) {
  globalThis.fetch = jest.fn().mockRejectedValue(new Error(message))
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('status', () => {
  it('should show help with --help', async () => {
    const result = await Status.new().parse(['--help'], defaultTestConfig())
    expect(result).toContain('Show Prisma Data Platform service status')
    expect(result).toContain('--json')
  })

  it('should display all operational services', async () => {
    mockFetchSuccess(makeSummary())

    const result = stripVTControlCharacters((await Status.new().parse([], defaultTestConfig())) as string)

    expect(result).toContain('All Systems Operational')
    expect(result).toContain('Services')
    expect(result).toContain('Accelerate')
    expect(result).toContain('Console')
    expect(result).toContain('Operational')
    expect(result).not.toContain('Active Incidents')
    expect(result).toContain('https://www.prisma-status.com')
  })

  it('should strip Prisma prefix from component names', async () => {
    mockFetchSuccess(makeSummary())

    const result = stripVTControlCharacters((await Status.new().parse([], defaultTestConfig())) as string)

    expect(result).not.toMatch(/Prisma Accelerate/)
    expect(result).toMatch(/Accelerate\s+Operational/)
  })

  it('should display active incidents', async () => {
    mockFetchSuccess(
      makeSummary({
        status: { indicator: 'major', description: 'Major System Outage' },
        components: [
          { id: '1', name: 'Prisma Accelerate', status: 'degraded_performance', position: 1, group: false, group_id: null, description: null },
        ],
        incidents: [
          {
            id: 'inc1',
            name: 'Accelerate degraded performance',
            status: 'investigating',
            impact: 'major',
            created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            incident_updates: [{ status: 'investigating', body: 'Looking into it.', created_at: new Date().toISOString() }],
          },
        ],
      }),
    )

    const result = stripVTControlCharacters((await Status.new().parse([], defaultTestConfig())) as string)

    expect(result).toContain('Major System Outage')
    expect(result).toContain('Degraded')
    expect(result).toContain('Active Incidents')
    expect(result).toContain('major')
    expect(result).toContain('Accelerate degraded performance')
    expect(result).toContain('2h ago')
    expect(result).toContain('investigating:')
    expect(result).toContain('Looking into it.')
  })

  it('should display scheduled maintenances and hide completed ones', async () => {
    mockFetchSuccess(
      makeSummary({
        scheduled_maintenances: [
          {
            id: 'm1',
            name: 'Database migration',
            status: 'scheduled',
            scheduled_for: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            incident_updates: [{ status: 'scheduled', body: 'Planned downtime.', created_at: new Date().toISOString() }],
          },
          {
            id: 'm2',
            name: 'Old maintenance',
            status: 'completed',
            scheduled_for: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
            incident_updates: [],
          },
        ],
      }),
    )

    const result = stripVTControlCharacters((await Status.new().parse([], defaultTestConfig())) as string)

    expect(result).toContain('Scheduled Maintenances')
    expect(result).toContain('Database migration')
    expect(result).toContain('Planned downtime.')
    expect(result).not.toContain('Old maintenance')
  })

  it('should output raw JSON with --json', async () => {
    const summary = makeSummary()
    mockFetchSuccess(summary)

    const result = (await Status.new().parse(['--json'], defaultTestConfig())) as string
    const parsed = JSON.parse(result)

    expect(parsed.status.indicator).toBe('none')
    expect(parsed.components).toHaveLength(4)
  })

  it('should handle network errors gracefully', async () => {
    mockFetchNetworkError('fetch failed')

    const result = stripVTControlCharacters((await Status.new().parse([], defaultTestConfig())) as string)

    expect(result).toContain('Could not reach status API')
    expect(result).toContain('fetch failed')
    expect(result).toContain('https://www.prisma-status.com')
  })

  it('should return JSON error on network failure with --json', async () => {
    mockFetchNetworkError('timeout')

    const result = (await Status.new().parse(['--json'], defaultTestConfig())) as string
    const parsed = JSON.parse(result)

    expect(parsed.error).toBe('timeout')
  })

  it('should handle HTTP errors gracefully', async () => {
    mockFetchHttpError(503)

    const result = stripVTControlCharacters((await Status.new().parse([], defaultTestConfig())) as string)

    expect(result).toContain('Status API returned HTTP 503')
    expect(result).toContain('https://www.prisma-status.com')
  })

  it('should return JSON error on HTTP failure with --json', async () => {
    mockFetchHttpError(500)

    const result = (await Status.new().parse(['--json'], defaultTestConfig())) as string
    const parsed = JSON.parse(result)

    expect(parsed.error).toBe('Status API returned HTTP 500')
  })

  it('should filter out group components', async () => {
    mockFetchSuccess(
      makeSummary({
        components: [
          { id: 'g1', name: 'Group', status: 'operational', position: 0, group: true, group_id: null, description: null },
          { id: '1', name: 'Prisma Accelerate', status: 'operational', position: 1, group: false, group_id: 'g1', description: null },
        ],
      }),
    )

    const result = stripVTControlCharacters((await Status.new().parse([], defaultTestConfig())) as string)

    expect(result).not.toMatch(/^\s*Group\s/m)
    expect(result).toContain('Accelerate')
  })
})
