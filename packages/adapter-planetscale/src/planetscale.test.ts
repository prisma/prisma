import { Client, connect } from '@planetscale/database'
import { fetch as undiciFetch } from 'undici'

import { PrismaPlanetScale } from './planetscale'

describe('validation', () => {
  test('throws if passed Connection instance', () => {
    const connection = connect({ url: 'http://example.com', fetch: undiciFetch })

    expect(() => {
      // @ts-ignore
      new PrismaPlanetScale(connection)
    }).toThrowErrorMatchingInlineSnapshot(`
      "PrismaPlanetScale must be initialized with an instance of Client:
      import { Client } from '@planetscale/database'
      const client = new Client({ url })
      const adapter = new PrismaPlanetScale(client)
      "
    `)
  })

  test('accepts Client instance', () => {
    const client = new Client({ url: 'http://example.com' })

    expect(() => {
      new PrismaPlanetScale(client)
    }).not.toThrow()
  })
})
