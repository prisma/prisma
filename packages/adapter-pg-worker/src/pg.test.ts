import { Client, Pool } from '@prisma/pg-worker'

import { PrismaPgAdapter } from './pg'

describe('validation', () => {
  test('throws if passed Client instance', () => {
    const client = new Client()

    expect(() => {
      // @ts-ignore
      new PrismaPgAdapter(client)
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
      new PrismaPgAdapter(pool)
    }).not.toThrow()
  })
})
