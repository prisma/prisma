import { describe, expect, test } from 'vitest'

import { PrismaMariaDbAdapterFactory } from './mariadb'

describe('credential sanitization', () => {
  test('connection string parse error should not expose password', async () => {
    const secretPassword = 'super_secret_password_12345'
    // A connection string with a port but no host, which the mariadb driver rejects while
    // echoing the whole string, including the password, back in its error message.
    const connectionString = `mariadb://user:${secretPassword}@:3306/db`

    const factory = new PrismaMariaDbAdapterFactory(connectionString)

    await expect(factory.connect()).rejects.toThrow()
    await expect(factory.connect()).rejects.not.toThrow(secretPassword)
  })
})
