import { Pool } from 'pg'

import { PrismaPgAdapter } from './pg'

describe('validation', () => {
  test('accepts Pool instance', () => {
    const pool = new Pool()

    expect(() => {
      new PrismaPgAdapter(pool)
    }).not.toThrow()
  })
})
