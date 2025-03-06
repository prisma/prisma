import { Pool } from 'pg'

import { PrismaPg } from './pg'

describe('validation', () => {
  test('accepts Pool instance', () => {
    const pool = new Pool()

    expect(() => {
      new PrismaPg(pool)
    }).not.toThrow()
  })
})
