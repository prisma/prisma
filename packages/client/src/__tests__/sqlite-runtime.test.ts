import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { setupSqliteTestDatabase, type SqliteTestEnvironment } from './helpers/sqlite-test-environment'

describe('SQLite client integration', () => {
  let testEnv: SqliteTestEnvironment

  beforeAll(async () => {
    testEnv = await setupSqliteTestDatabase()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  it('supports basic CRUD operations', async () => {
    const created = await testEnv.client.user.create({
      data: { email: 'sqlite-alice@example.com', name: 'SQLite Alice' },
    })

    const found = await testEnv.client.user.findUnique({
      where: { id: created.id },
    })

    expect(found).toBeDefined()
    expect(found?.email).toBe('sqlite-alice@example.com')

    const updated = await testEnv.client.user.update({
      where: { id: created.id },
      data: { name: 'SQLite Alice Updated' },
    })

    expect(updated.name).toBe('SQLite Alice Updated')

    const deleted = await testEnv.client.user.delete({
      where: { id: created.id },
    })

    expect(deleted.email).toBe('sqlite-alice@example.com')

    const afterDelete = await testEnv.client.user.findUnique({
      where: { id: created.id },
    })

    expect(afterDelete).toBeNull()
  })

  it('supports $transaction with commit and rollback behavior', async () => {
    const txResult = await testEnv.client.$transaction(async (txClient: typeof testEnv.client) => {
      const user = await txClient.user.create({
        data: { email: 'sqlite-tx@example.com', name: 'SQLite Tx' },
      })

      const post = await txClient.post.create({
        data: {
          title: 'SQLite Transaction Post',
          content: 'hello',
          published: false,
          authorId: user.id,
        },
      })

      return { user, post }
    })

    const txUser = await testEnv.client.user.findUnique({
      where: { id: txResult.user.id },
    })

    expect(txUser).toBeDefined()

    await expect(
      testEnv.client.$transaction(async (txClient: typeof testEnv.client) => {
        await txClient.user.create({
          data: { email: 'sqlite-rollback@example.com', name: 'SQLite Rollback' },
        })
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    const rollbackUser = await testEnv.client.user.findUnique({
      where: { email: 'sqlite-rollback@example.com' },
    })

    expect(rollbackUser).toBeNull()
  })
})
