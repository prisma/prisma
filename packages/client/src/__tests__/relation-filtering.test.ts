import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { clearTestData, SeedData, seedTestData } from './helpers/seed'
import { setupTestDatabase, TestEnvironment } from './helpers/test-container'

/**
 * Tests for Relation Filtering
 *
 * Relation filters allow filtering parent records based on conditions on related records.
 * These are implemented using SQL EXISTS subqueries.
 *
 * For one-to-many relations (ListRelationFilter):
 * - `some`: filter to records where at least one related record matches
 * - `every`: filter to records where all related records match
 * - `none`: filter to records where no related records match
 *
 * For one-to-one relations (RelationFilter):
 * - `is`: filter by singular relation matching condition (or null check)
 * - `isNot`: filter by singular relation not matching condition
 */
describe('Relation Filtering', () => {
  let testEnv: TestEnvironment
  let seedData: SeedData

  beforeAll(async () => {
    testEnv = await setupTestDatabase()
    seedData = await seedTestData(testEnv.kysely)
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  describe('One-to-many: posts (ListRelationFilter)', () => {
    it('should filter users with some published posts', async () => {
      // Expected: Alice (has 2 published posts), Bob (has 1 published post)
      // Charlie has no posts
      const users = await testEnv.client.user.findMany({
        where: { posts: { some: { published: true } } },
      })

      expect(users).toHaveLength(2)
      expect(users.map((u) => u.email)).toEqual(expect.arrayContaining(['alice@example.com', 'bob@example.com']))
    })

    it('should filter users where every post is published', async () => {
      // Expected: Bob (only has 1 published post, so "every" is satisfied)
      // Alice has 1 unpublished post, so should be excluded
      const users = await testEnv.client.user.findMany({
        where: { posts: { every: { published: true } } },
      })

      expect(users).toHaveLength(1)
      expect(users[0].email).toBe('bob@example.com')
    })

    it('should filter users with no published posts', async () => {
      // Expected: Charlie (has no posts at all)
      // Alice has published posts, Bob has published posts
      const users = await testEnv.client.user.findMany({
        where: { posts: { none: { published: true } } },
      })

      expect(users).toHaveLength(1)
      expect(users[0].email).toBe('charlie@example.com')
    })

    it('should handle complex nested conditions in some', async () => {
      // Expected: Alice (has "Getting Started with TypeScript" which is published)
      const users = await testEnv.client.user.findMany({
        where: {
          posts: {
            some: {
              AND: [{ published: true }, { title: { contains: 'TypeScript' } }],
            },
          },
        },
      })

      expect(users).toHaveLength(1)
      expect(users[0].email).toBe('alice@example.com')
    })
  })

  describe('One-to-one: profile (RelationFilter)', () => {
    it('should filter users with profile matching condition', async () => {
      // Expected: Alice (has profile with bio containing "developer")
      const users = await testEnv.client.user.findMany({
        where: {
          profile: { is: { bio: { contains: 'developer' } } },
        },
      })

      expect(users).toHaveLength(1)
      expect(users[0].email).toBe('alice@example.com')
    })

    it('should filter users with profile not matching condition', async () => {
      // Expected: Bob (has profile but bio is null)
      const users = await testEnv.client.user.findMany({
        where: {
          profile: { isNot: { bio: { contains: 'developer' } } },
        },
      })

      expect(users).toHaveLength(1)
      expect(users[0].email).toBe('bob@example.com')
    })

    it('should filter users with null profile', async () => {
      // Expected: Charlie (has no profile)
      const users = await testEnv.client.user.findMany({
        where: { profile: { is: null } },
      })

      expect(users).toHaveLength(1)
      expect(users[0].email).toBe('charlie@example.com')
    })
  })

  describe('Combining relation and scalar filters', () => {
    it('should combine relation filters with scalar filters using AND', async () => {
      // Expected: Alice and Bob (both have @example.com emails and published posts)
      const users = await testEnv.client.user.findMany({
        where: {
          AND: [{ email: { endsWith: '@example.com' } }, { posts: { some: { published: true } } }],
        },
      })

      expect(users).toHaveLength(2)
    })

    it('should combine relation filters with scalar filters using OR', async () => {
      // Expected: Alice (has "Advanced Prisma Patterns" post) and Charlie (name is null)
      const users = await testEnv.client.user.findMany({
        where: {
          OR: [{ name: null }, { posts: { some: { title: { contains: 'Prisma' } } } }],
        },
      })

      expect(users).toHaveLength(2)
      const emails = users.map((u) => u.email)
      expect(emails).toContain('alice@example.com')
      expect(emails).toContain('charlie@example.com')
    })
  })
})
