import { Client, Pool } from '@neondatabase/serverless'

import { PrismaNeon, PrismaNeonHTTP } from './neon'

describe('validation', () => {
  test('throws if passed Client instance', () => {
    const client = new Client()

    expect(() => {
      // @ts-ignore
      new PrismaNeon(client)
    }).toThrowErrorMatchingInlineSnapshot(`
      "PrismaNeon must be initialized with an instance of Pool:
      import { Pool } from '@neondatabase/serverless'
      const pool = new Pool({ connectionString: url })
      const adapter = new PrismaNeon(pool)
      "
    `)
  })

  test('accepts Pool instance', () => {
    const pool = new Pool()

    expect(() => {
      new PrismaNeon(pool)
    }).not.toThrow()
  })
})

describe('neon version support', () => {
  it('supports @neondatabase/serverless < 1.0.0', async () => {
    // Before v0 client is directly callable to execute the SQL
    const v0NeonClientMock = jest
      .fn()
      .mockResolvedValue({ fields: [], command: '', rowCount: 0, rows: [], rowAsArray: false })

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const adapter = new PrismaNeonHTTP(v0NeonClientMock as any)

    await adapter.queryRaw({ sql: 'SELECT 1', args: [], argTypes: [] })

    expect(v0NeonClientMock).toHaveBeenCalledWith('SELECT 1', [], {
      arrayMode: true,
      fullResults: true,
      types: { getTypeParser: expect.anything() },
    })
  })

  it('supports @neondatabase/serverless >= 1.0.0', async () => {
    // With v1 client is only callable via the `query` method
    const mockQueryFn = jest
      .fn()
      .mockResolvedValue({ fields: [], command: '', rowCount: 0, rows: [], rowAsArray: false })
    const v1NeonClientMock = {
      query: mockQueryFn,
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const adapter = new PrismaNeonHTTP(v1NeonClientMock as any)

    await adapter.queryRaw({ sql: 'SELECT 1', args: [], argTypes: [] })

    expect(mockQueryFn).toHaveBeenCalledWith('SELECT 1', [], {
      arrayMode: true,
      fullResults: true,
      types: { getTypeParser: expect.anything() },
    })
  })
})
