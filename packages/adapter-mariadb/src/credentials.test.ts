import { describe, expect, test } from 'vitest'

import { PrismaMariaDbAdapterFactory } from './mariadb'

describe('credential sanitization', () => {
  test('connection string parse error should not expose password', async () => {
    const secretPassword = 'super_secret_password_12345'
    // IPv6 address in brackets - causes parse error in mariadb driver
    const connectionString = `mariadb://user:${secretPassword}@[64:ff9b::23be:d64c]/db`

    const factory = new PrismaMariaDbAdapterFactory(connectionString)

    try {
      await factory.connect()
      expect.fail('Expected connection to fail')
    } catch (error) {
      const errorMessage = String(error)
      expect(errorMessage).not.toContain(secretPassword)
    }
  })
})
