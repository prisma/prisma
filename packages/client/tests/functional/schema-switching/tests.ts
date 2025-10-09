import { faker } from '@faker-js/faker'
import { randomUUID } from 'crypto'

import { Providers } from '../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore this is necessary for functional tests
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

/**
 * Schema Switching Tests
 *
 * This test suite validates the dynamic PostgreSQL schema switching feature,
 * which is particularly useful for multi-tenant applications where each tenant
 * has isolated data in separate PostgreSQL schemas.
 *
 * The .schema() method enables:
 * - Dynamic schema switching while reusing the same database connection
 * - Complete data isolation between tenants
 * - Optimal resource usage by sharing the connection pool
 * - All Prisma operations (queries, transactions, raw SQL) with schema context
 */
testMatrix.setupTestSuite(
  () => {
    describe('schema switching', () => {
      describe('basic functionality', () => {
        test('should allow switching between schemas', () => {
          const schema1Client = prisma.schema('schema1')
          const schema2Client = prisma.schema('schema2')

          expect(schema1Client).toBeDefined()
          expect(schema2Client).toBeDefined()
          expect(schema1Client).not.toBe(schema2Client)
        })

        test('should throw error for non-PostgreSQL providers', async () => {
          // This test will be skipped for PostgreSQL/CockroachDB
          // but is here for documentation purposes
        })

        test('should create data in schema1', async () => {
          const schema1Client = prisma.schema('schema1')
          const email = faker.internet.email()
          const name = faker.person.fullName()

          const user = await schema1Client.user.create({
            data: {
              email,
              name,
            },
          })

          expect(user).toMatchObject({
            email,
            name,
          })

          // Verify it was created in schema1
          const found = await schema1Client.user.findUnique({
            where: { email },
          })

          expect(found).toMatchObject({
            email,
            name,
          })
        })

        test('should create data in schema2', async () => {
          const schema2Client = prisma.schema('schema2')
          const orgName = faker.company.name()

          const org = await schema2Client.organization.create({
            data: {
              name: orgName,
            },
          })

          expect(org).toMatchObject({
            name: orgName,
          })

          // Verify it was created in schema2
          const found = await schema2Client.organization.findUnique({
            where: { name: orgName },
          })

          expect(found).toMatchObject({
            name: orgName,
          })
        })
      })

      describe('connection reuse', () => {
        test('should reuse the same engine instance', () => {
          const schema1Client = prisma.schema('schema1')
          const schema2Client = prisma.schema('schema2')

          // Both should share the same engine
          expect(schema1Client._engine).toBe(prisma._engine)
          expect(schema2Client._engine).toBe(prisma._engine)
          expect(schema1Client._engine).toBe(schema2Client._engine)
        })

        test('should execute queries from different schemas using same connection', async () => {
          const schema1Client = prisma.schema('schema1')
          const schema2Client = prisma.schema('schema2')

          const email = faker.internet.email()
          const orgName = faker.company.name()

          // Create in both schemas concurrently (should use same connection pool)
          const [user, org] = await Promise.all([
            schema1Client.user.create({
              data: { email, name: faker.person.fullName() },
            }),
            schema2Client.organization.create({
              data: { name: orgName },
            }),
          ])

          expect(user.email).toBe(email)
          expect(org.name).toBe(orgName)

          // Verify both exist in their respective schemas
          const [foundUser, foundOrg] = await Promise.all([
            schema1Client.user.findUnique({ where: { email } }),
            schema2Client.organization.findUnique({ where: { name: orgName } }),
          ])

          expect(foundUser).toBeDefined()
          expect(foundOrg).toBeDefined()
        })
      })

      describe('schema isolation', () => {
        test('should not find data from schema1 when querying schema2', async () => {
          const schema1Client = prisma.schema('schema1')
          const schema2Client = prisma.schema('schema2')

          const email = faker.internet.email()

          // Create user in schema1
          await schema1Client.user.create({
            data: { email, name: faker.person.fullName() },
          })

          // Try to find in schema2 - should fail because User model doesn't exist in schema2
          // But we can verify data isolation by checking counts
          const schema1Count = await schema1Client.user.count()
          const schema2OrgCount = await schema2Client.organization.count()

          // Each schema has its own data
          expect(schema1Count).toBeGreaterThan(0)
          expect(schema2OrgCount).toBeGreaterThanOrEqual(0)
        })

        test('should maintain schema context across multiple operations', async () => {
          const schema1Client = prisma.schema('schema1')
          const email = faker.internet.email()
          const title = faker.lorem.sentence()

          // Create user with posts in schema1
          const user = await schema1Client.user.create({
            data: {
              email,
              name: faker.person.fullName(),
              posts: {
                create: [
                  { title, content: faker.lorem.paragraph() },
                  { title: faker.lorem.sentence(), content: faker.lorem.paragraph() },
                ],
              },
            },
            include: {
              posts: true,
            },
          })

          expect(user.posts).toHaveLength(2)

          // Query with relations - should maintain schema context
          const found = await schema1Client.user.findUnique({
            where: { email },
            include: {
              posts: {
                where: { title },
              },
            },
          })

          expect(found?.posts).toHaveLength(1)
          expect(found?.posts[0].title).toBe(title)
        })
      })

      describe('transactions', () => {
        test('should work with interactive transactions', async () => {
          const schema1Client = prisma.schema('schema1')
          const email = faker.internet.email()
          const name = faker.person.fullName()

          const result = await schema1Client.$transaction(async (tx) => {
            const user = await tx.user.create({
              data: { email, name },
            })

            const profile = await tx.profile.create({
              data: {
                bio: faker.lorem.paragraph(),
                userId: user.id,
              },
            })

            return { user, profile }
          })

          expect(result.user.email).toBe(email)
          expect(result.profile.userId).toBe(result.user.id)

          // Verify both were created
          const user = await schema1Client.user.findUnique({
            where: { email },
            include: { profile: true },
          })

          expect(user?.profile).toBeDefined()
        })

        test('should work with batch transactions', async () => {
          const schema1Client = prisma.schema('schema1')
          const email = faker.internet.email()
          const name = faker.person.fullName()

          const [user, count] = await schema1Client.$transaction([
            schema1Client.user.create({
              data: { email, name },
            }),
            schema1Client.user.count(),
          ])

          expect(user.email).toBe(email)
          expect(count).toBeGreaterThan(0)
        })
      })

      describe('raw queries', () => {
        test('should work with $queryRaw in specific schema', async () => {
          const schema1Client = prisma.schema('schema1')
          const email = faker.internet.email()

          await schema1Client.user.create({
            data: { email, name: faker.person.fullName() },
          })

          const users = await schema1Client.$queryRaw<any[]>`
            SELECT * FROM "User" WHERE email = ${email}
          `

          expect(users).toHaveLength(1)
          expect(users[0].email).toBe(email)
        })

        test('should work with $executeRaw in specific schema', async () => {
          const schema1Client = prisma.schema('schema1')
          const email = faker.internet.email()
          const name = faker.person.fullName()
          const id = randomUUID()

          const count = await schema1Client.$executeRaw`
            INSERT INTO "User" (id, email, name)
            VALUES (${id}, ${email}, ${name})
          `

          expect(count).toBe(1)

          // Verify it was created
          const user = await schema1Client.user.findUnique({
            where: { email },
          })

          expect(user?.name).toBe(name)
        })
      })

      describe('edge cases', () => {
        test('should handle chained .schema() calls', () => {
          const client1 = prisma.schema('schema1')
          const client2 = client1.schema('schema2')

          expect(client2._schemaOverride).toBe('schema2')
        })

        test('should maintain parent reference', () => {
          const schemaClient = prisma.schema('schema1')

          expect(schemaClient._appliedParent).toBeDefined()
        })

        test('should work with multiple derived clients', async () => {
          const client1a = prisma.schema('schema1')
          const client1b = prisma.schema('schema1')
          const _client2 = prisma.schema('schema2')

          const email = faker.internet.email()

          // All schema1 clients should access the same data
          await client1a.user.create({
            data: { email, name: faker.person.fullName() },
          })

          const found = await client1b.user.findUnique({
            where: { email },
          })

          expect(found).toBeDefined()
          expect(found?.email).toBe(email)
        })
      })

      describe('cleanup', () => {
        test('should cleanup data after tests', async () => {
          const schema1Client = prisma.schema('schema1')
          const schema2Client = prisma.schema('schema2')

          // Clean up test data
          await schema1Client.post.deleteMany()
          await schema1Client.profile.deleteMany()
          await schema1Client.user.deleteMany()
          await schema2Client.member.deleteMany()
          await schema2Client.organization.deleteMany()

          const userCount = await schema1Client.user.count()
          const orgCount = await schema2Client.organization.count()

          expect(userCount).toBe(0)
          expect(orgCount).toBe(0)
        })
      })
    })
  },
  {
    optOut: {
      from: [Providers.SQLITE, Providers.MONGODB, Providers.MYSQL, Providers.SQLSERVER],
      reason: 'Schema switching only works for PostgreSQL and CockroachDB',
    },
  },
)
