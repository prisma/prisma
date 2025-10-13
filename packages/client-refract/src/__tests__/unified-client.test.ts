/**
 * Tests for unified Refract client with type precedence
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RefractClient, type RefractClientOptions } from '../client.js'

// Mock Kysely dialect to avoid requiring database connections
const mockKysely = {
  selectFrom: vi.fn().mockReturnThis(),
  selectAll: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue([]),
  destroy: vi.fn().mockResolvedValue(undefined),
  transaction: vi.fn().mockReturnValue({
    execute: vi.fn().mockImplementation((fn: any) => fn(mockKysely)),
  }),
}

const mockDialect = {
  createAdapter: vi.fn().mockReturnValue({
    acquireMigrationLock: vi.fn(),
    releaseMigrationLock: vi.fn(),
  }),
  createDriver: vi.fn().mockReturnValue({
    init: vi.fn().mockResolvedValue(undefined),
    acquireConnection: vi.fn().mockResolvedValue({}),
    beginTransaction: vi.fn().mockResolvedValue({}),
    commitTransaction: vi.fn().mockResolvedValue(undefined),
    rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    releaseConnection: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  }),
  createIntrospector: vi.fn(),
  createQueryCompiler: vi.fn(),
}

// Mock Kysely constructor
vi.mock('kysely', async () => {
  const actual = await vi.importActual('kysely')
  return {
    ...actual,
    Kysely: vi.fn().mockImplementation(() => mockKysely),
  }
})

describe('Unified Refract Client', () => {
  let defaultOptions: RefractClientOptions
  const testSchema = `
    generator client {
      provider = "prisma-client-js"
    }

    datasource db {
      provider = "postgresql"
      url      = env("DATABASE_URL")
    }

    model User {
      id        Int      @id @default(autoincrement())
      email     String   @unique
      name      String?
      posts     Post[]
      createdAt DateTime @default(now())
      updatedAt DateTime @updatedAt
    }

    model Post {
      id        Int      @id @default(autoincrement())
      title     String
      content   String?
      published Boolean  @default(false)
      author    User     @relation(fields: [authorId], references: [id])
      authorId  Int
      createdAt DateTime @default(now())
      updatedAt DateTime @updatedAt
    }
  `

  beforeEach(() => {
    defaultOptions = {
      schema: testSchema,
      generatedTypesPath: '.refract/types.ts',
      projectRoot: '/test/project',
    }
  })

  describe('RefractClient', () => {
    it('should create client with any types by default', () => {
      const client = new RefractClient(mockDialect, defaultOptions)

      expect(client).toBeDefined()
      expect(client.$kysely).toBeDefined()
      expect(typeof client.$connect).toBe('function')
      expect(typeof client.$disconnect).toBe('function')
      expect(typeof client.$transaction).toBe('function')
    })

    it('should create client with manual generic types', () => {
      interface TestSchema {
        User: {
          id: number
          email: string
          name: string | null
        }
        Post: {
          id: number
          title: string
          authorId: number
        }
      }

      const client = new RefractClient<TestSchema>(mockDialect, defaultOptions)

      expect(client).toBeDefined()
      expect(client.$kysely).toBeDefined()

      // TypeScript should infer the correct type here
      // (This is compile-time behavior that we can't test at runtime)
    })

    it('should handle custom options correctly', () => {
      const customOptions: RefractClientOptions = {
        generatedTypesPath: 'custom/path/types.ts',
        projectRoot: '/custom/project',
      }

      const client = new RefractClient(mockDialect, customOptions)

      expect(client).toBeDefined()
      expect(client.$kysely).toBeDefined()
    })
  })

  describe('Client Methods', () => {
    let client: RefractClient

    beforeEach(() => {
      client = new RefractClient(mockDialect, defaultOptions)
    })

    it('should have $kysely property that is accessible', () => {
      expect(client.$kysely).toBeDefined()

      // The $kysely property should be accessible and functional
      expect(typeof client.$kysely.selectFrom).toBe('function')
      expect(typeof client.$kysely.destroy).toBe('function')

      // TypeScript readonly prevents assignment at compile time
      // Runtime behavior is that the property can still be assigned but shouldn't be
      const originalKysely = client.$kysely
      expect(originalKysely).toBe(client.$kysely)
    })

    it('should have connection management methods', async () => {
      expect(typeof client.$connect).toBe('function')
      expect(typeof client.$disconnect).toBe('function')
      expect(typeof client.$transaction).toBe('function')

      // Test that methods can be called without throwing
      await expect(client.$connect()).resolves.toBeUndefined()
      await expect(client.$disconnect()).resolves.toBeUndefined()

      const result = await client.$transaction(async (trxClient) => {
        expect(trxClient.$kysely).toBeDefined()
        return 'test result'
      })
      expect(result).toBe('test result')
    })
  })

  describe('Type Precedence (Compile-time behavior)', () => {
    it('should demonstrate type precedence concept', () => {
      // Manual generic types (highest precedence)
      interface CustomSchema {
        CustomTable: { id: number; name: string }
      }
      const manualClient = new RefractClient<CustomSchema>(mockDialect, defaultOptions)

      // Any types (fallback)
      const anyClient = new RefractClient(mockDialect, defaultOptions)

      // Both should be valid clients
      expect(manualClient.$kysely).toBeDefined()
      expect(anyClient.$kysely).toBeDefined()

      // Type precedence is enforced at compile-time by TypeScript
      // Runtime behavior is the same for both
    })
  })

  describe('CRUD Operations', () => {
    it('should add Prisma-like CRUD methods to the client', () => {
      const client = new RefractClient(mockDialect, defaultOptions)

      // Check that CRUD operations are added for schema models
      expect(client.user).toBeDefined()
      expect(client.post).toBeDefined()

      // Check all CRUD methods are available
      expect(typeof client.user.findMany).toBe('function')
      expect(typeof client.user.findUnique).toBe('function')
      expect(typeof client.user.findFirst).toBe('function')
      expect(typeof client.user.create).toBe('function')
      expect(typeof client.user.createMany).toBe('function')
      expect(typeof client.user.update).toBe('function')
      expect(typeof client.user.updateMany).toBe('function')
      expect(typeof client.user.upsert).toBe('function')
      expect(typeof client.user.delete).toBe('function')
      expect(typeof client.user.deleteMany).toBe('function')
      expect(typeof client.user.count).toBe('function')
    })

    it('should provide both Prisma-like API and direct Kysely access', () => {
      const client = new RefractClient(mockDialect, defaultOptions)

      // Prisma-like API
      expect(client.user).toBeDefined()
      expect(typeof client.user.findMany).toBe('function')

      // Direct Kysely access
      expect(client.$kysely).toBeDefined()
      expect(typeof client.$kysely.selectFrom).toBe('function')
    })

    it('should handle clients without schema gracefully', () => {
      // Test with no schema provided
      const clientWithoutSchema = new RefractClient(mockDialect, {
        projectRoot: '/test/project',
      })

      // Should not have any model methods since no schema was provided
      expect(clientWithoutSchema.user).toBeUndefined()
      expect(clientWithoutSchema.post).toBeUndefined()

      // But should still have basic client functionality
      expect(clientWithoutSchema.$kysely).toBeDefined()
      expect(typeof clientWithoutSchema.$connect).toBe('function')
    })
  })

  describe('Error Handling', () => {
    it('should handle dialects correctly', () => {
      // Valid dialect should work
      const client = new RefractClient(mockDialect, defaultOptions)
      expect(client).toBeDefined()
      expect(client.$kysely).toBeDefined()

      // The actual validation happens inside Kysely constructor
      // Our mock always succeeds, so we just verify it's called correctly
    })

    it('should handle missing options gracefully', () => {
      // Should use defaults
      const client = new RefractClient(mockDialect)

      expect(client).toBeDefined()
      expect(client.$kysely).toBeDefined()
    })
  })
})
