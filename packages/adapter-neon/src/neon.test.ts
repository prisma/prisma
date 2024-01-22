import { Client, Pool } from '@neondatabase/serverless'

import { PrismaNeon } from './neon'

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
