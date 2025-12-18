import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTestDatabase, type TestEnvironment } from './helpers/test-container'
import { seedTestData } from './helpers/seed'

/**
 * Runtime tests for unique constraint operations
 *
 * Tests that findUnique, update, and delete operations work correctly
 * when querying by @id and @unique fields.
 *
 * Note: Type-level tests for WhereUniqueInput are in unique-constraints-types.test.ts
 */
describe('WhereUniqueInput Constraints', () => {
  let testEnv: TestEnvironment

  beforeAll(async () => {
    testEnv = await setupTestDatabase()
    await seedTestData(testEnv.kysely)
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  describe('findUnique', () => {
    it('should find user by @id field', async () => {
      const result = await testEnv.client.user.findUnique({
        where: { id: 1 },
      })

      expect(result).toBeDefined()
      expect(result?.email).toBe('alice@example.com')
    })

    it('should find user by @unique field (email)', async () => {
      const result = await testEnv.client.user.findUnique({
        where: { email: 'bob@example.com' },
      })

      expect(result).toBeDefined()
      expect(result?.name).toBe('Bob')
    })
  })

  describe('update', () => {
    it('should update using @id field', async () => {
      const result = await testEnv.client.user.update({
        where: { id: 1 },
        data: { name: 'Alice Updated' },
      })

      expect(result.name).toBe('Alice Updated')

      // Reset
      await testEnv.client.user.update({
        where: { id: 1 },
        data: { name: 'Alice' },
      })
    })

    it('should update using @unique field (email)', async () => {
      const result = await testEnv.client.user.update({
        where: { email: 'bob@example.com' },
        data: { name: 'Bob Updated' },
      })

      expect(result.name).toBe('Bob Updated')

      // Reset
      await testEnv.client.user.update({
        where: { email: 'bob@example.com' },
        data: { name: 'Bob' },
      })
    })
  })

  describe('delete', () => {
    it('should delete using @id field', async () => {
      // Insert a temp user to delete
      const tempUser = await testEnv.client.user.create({
        data: { email: 'temp@example.com', name: 'Temp' },
      })

      const result = await testEnv.client.user.delete({
        where: { id: tempUser.id },
      })

      expect(result.email).toBe('temp@example.com')

      // Verify deletion
      const deleted = await testEnv.client.user.findUnique({
        where: { id: tempUser.id },
      })

      expect(deleted).toBeUndefined()
    })

    it('should delete using @unique field (email)', async () => {
      // Insert a temp user to delete
      const tempUser = await testEnv.client.user.create({
        data: { email: 'temp2@example.com', name: 'Temp2' },
      })

      const result = await testEnv.client.user.delete({
        where: { email: tempUser.email },
      })

      expect(result.email).toBe('temp2@example.com')

      // Verify deletion
      const deleted = await testEnv.client.user.findUnique({
        where: { email: tempUser.email },
      })

      expect(deleted).toBeUndefined()
    })
  })
})
