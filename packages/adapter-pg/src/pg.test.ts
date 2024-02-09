import { Client, Pool } from 'pg'

import { PrismaPg } from './pg'

describe('validation', () => {
  test('throws if passed Client instance', () => {
    const client = new Client()

    expect(() => {
      // @ts-ignore
      new PrismaPg(client)
    }).toThrowErrorMatchingInlineSnapshot(`
      "PrismaPg must be initialized with an instance of Pool:
      import { Pool } from 'pg'
      const pool = new Pool({ connectionString: url })
      const adapter = new PrismaPg(pool)
      "
    `)
  })

  test('accepts Pool instance', () => {
    const pool = new Pool()

    expect(() => {
      new PrismaPg(pool)
    }).not.toThrow()
  })
})
