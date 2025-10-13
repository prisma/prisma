import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RefractMigrate } from '../RefractMigrate.js'

// Mock console.warn to suppress expected warnings during tests
const originalConsoleWarn = console.warn
beforeEach(() => {
  console.warn = vi.fn()
})

afterEach(() => {
  console.warn = originalConsoleWarn
})

import { KyselyMockFactory, SchemaASTMockFactory } from './mocks/kysely-mock-factory.ts'

// Mock the schema parser
vi.mock('@refract/schema-parser', () => ({
  parseSchema: vi.fn((schemaPath: string) => {
    // Return empty schema for empty schema test
    if (schemaPath.includes('Empty schema') || schemaPath.includes('// Empty schema')) {
      return SchemaASTMockFactory.createEmptySchema()
    }

    // Return User model for other tests
    return SchemaASTMockFactory.createUserSchema()
  }),
}))

// Create reusable mock instance
let mockKyselyInstance: any

describe('RefractMigrate', () => {
  let migrate: RefractMigrate

  beforeEach(() => {
    vi.clearAllMocks()

    // Create fresh mock instance for each test
    mockKyselyInstance = KyselyMockFactory.createMockWithMigrationTable()

    migrate = new RefractMigrate()
  })

  describe('constructor', () => {
    it('should create instance with default options', () => {
      expect(migrate).toBeInstanceOf(RefractMigrate)
    })

    it('should create instance with custom options', () => {
      const customOptions = {
        useTransaction: false,
        timeout: 60000,
        validateSchema: false,
        migrationTableName: 'custom_migrations',
      }

      const customMigrate = new RefractMigrate(customOptions)
      expect(customMigrate).toBeInstanceOf(RefractMigrate)
    })
  })

  describe('diff', () => {
    it('should generate migration diff', async () => {
      mockKyselyInstance = KyselyMockFactory.createEmptyDatabaseMock()

      const testSchema = `
        model User {
          id    Int     @id @default(autoincrement())
          name  String
          email String  @unique
        }
      `
      const result = await migrate.diff(mockKyselyInstance as any, testSchema)

      expect(result).toHaveProperty('statements')
      expect(result).toHaveProperty('summary')
      expect(result).toHaveProperty('hasDestructiveChanges')
      expect(result).toHaveProperty('impact')
      expect(Array.isArray(result.statements)).toBe(true)
    })

    it('should handle introspection errors', async () => {
      // Use the new spy wrapper approach for error handling
      mockKyselyInstance = KyselyMockFactory.createDatabaseErrorSpyMock(new Error('Database connection failed'))

      await expect(migrate.diff(mockKyselyInstance as any, './test-schema.prisma')).rejects.toThrow(
        'Failed to generate migration diff',
      )
    })
  })

  describe('apply', () => {
    it('should apply migrations successfully with no changes', async () => {
      // Use empty schema with empty database to truly have no changes
      mockKyselyInstance = KyselyMockFactory.createEmptyDatabaseMock()

      const testSchema = `// Empty schema`
      const result = await migrate.apply(mockKyselyInstance as any, testSchema)

      expect(result.success).toBe(true)
      expect(result.statementsExecuted).toBe(0)
      expect(result.errors).toHaveLength(0)
      expect(typeof result.executionTime).toBe('number')
    })

    it('should handle apply errors gracefully', async () => {
      // Demonstrate the new spy wrapper approach with better type safety
      mockKyselyInstance = KyselyMockFactory.createDatabaseErrorSpyMock(new Error('Database error'))

      const testSchema = `
        model User {
          id    Int     @id @default(autoincrement())
          name  String
          email String  @unique
        }
      `
      const result = await migrate.apply(mockKyselyInstance as any, testSchema)

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain('Database error')
    })
  })

  describe('getHistory', () => {
    it('should return migration history', async () => {
      mockKyselyInstance.introspection.getTables.mockResolvedValue([
        {
          name: '_refract_migrations',
          columns: [
            { name: 'id', dataType: 'varchar(255)', isNullable: false },
            { name: 'name', dataType: 'varchar(255)', isNullable: false },
            { name: 'checksum', dataType: 'varchar(255)', isNullable: false },
            { name: 'appliedAt', dataType: 'timestamp', isNullable: false },
            { name: 'executionTime', dataType: 'integer', isNullable: false },
            { name: 'success', dataType: 'boolean', isNullable: false },
          ],
        },
      ])

      const mockHistory = [
        {
          id: 'migration_1',
          name: 'Test Migration',
          checksum: 'abc123',
          appliedAt: '2024-01-01T00:00:00Z',
          executionTime: 1000,
          success: true,
        },
      ]

      const mockExecute = vi.fn().mockResolvedValue(mockHistory)
      const mockOrderBy = vi.fn(() => ({ execute: mockExecute }))
      const mockSelectAll = vi.fn(() => ({ orderBy: mockOrderBy }))
      mockKyselyInstance.selectFrom.mockReturnValue({ selectAll: mockSelectAll })

      const history = await migrate.getHistory(mockKyselyInstance as any)

      expect(Array.isArray(history)).toBe(true)
      expect(history).toHaveLength(1)
      expect(history[0]).toHaveProperty('id', 'migration_1')
      expect(history[0]).toHaveProperty('appliedAt')
      expect(history[0].appliedAt).toBeInstanceOf(Date)
    })
  })

  describe('DDL Generation with Kysely Builders', () => {
    it('should generate CREATE TABLE statement using Kysely DDL builders', async () => {
      mockKyselyInstance = KyselyMockFactory.createEmptyDatabaseMock()

      const testSchema = `
        model User {
          id    Int     @id @default(autoincrement())
          name  String
          email String  @unique
        }
      `
      const result = await migrate.diff(mockKyselyInstance as any, testSchema)

      expect(mockKyselyInstance.schema.createTable).toHaveBeenCalled()
      expect(result.statements).toEqual(expect.arrayContaining([expect.stringContaining('CREATE TABLE')]))
    })

    it('should create unique index for @unique fields', async () => {
      mockKyselyInstance = KyselyMockFactory.createEmptyDatabaseMock()

      const testSchema = `
        model User {
          id    Int     @id @default(autoincrement())
          name  String
          email String  @unique
        }
      `
      const result = await migrate.diff(mockKyselyInstance as any, testSchema)

      expect(result.summary.indexesCreated.some((n) => n.includes('uniq_User_email') || n.includes('uniq_user_email'))).toBe(true)
      expect(result.statements.some((s) => s.toUpperCase().includes('CREATE UNIQUE INDEX'))).toBe(true)
    })

    it('should produce deterministic SQL statements (golden snapshot)', async () => {
      mockKyselyInstance = KyselyMockFactory.createEmptyDatabaseMock()

      const testSchema = `
        model User {
          id     Int     @id @default(autoincrement())
          name   String
          email  String  @unique
        }
      `
      const result = await migrate.diff(mockKyselyInstance as any, testSchema)

      expect(result.statements).toMatchSnapshot()
    })

    it('should generate ALTER TABLE statements using Kysely DDL builders', async () => {
      mockKyselyInstance = KyselyMockFactory.createMockWithUserTable()

      const testSchema = `
        model User {
          id    Int     @id @default(autoincrement())
          name  String
          email String  @unique
        }
      `
      const result = await migrate.diff(mockKyselyInstance as any, testSchema)

      expect(result).toHaveProperty('statements')
      expect(Array.isArray(result.statements)).toBe(true)
    })

    it('should generate DROP TABLE statement using Kysely DDL builders', async () => {
      mockKyselyInstance = KyselyMockFactory.createKyselyMock({
        tables: [
          {
            name: 'old_table',
            schema: 'public',
            isView: false,
            columns: [
              { name: 'id', dataType: 'INTEGER', isNullable: false, hasDefaultValue: false, isAutoIncrementing: true },
            ],
          },
        ],
      })

      const testSchema = `
        model User {
          id    Int     @id @default(autoincrement())
          name  String
          email String  @unique
        }
      `
      const result = await migrate.diff(mockKyselyInstance as any, testSchema)

      expect(mockKyselyInstance.schema.dropTable).toHaveBeenCalledWith('old_table')
      expect(result.statements).toEqual(expect.arrayContaining([expect.stringContaining('DROP TABLE "old_table"')]))
      expect(result.hasDestructiveChanges).toBe(true)
    })

    it('should handle DDL generation errors gracefully', async () => {
      mockKyselyInstance = KyselyMockFactory.createEmptyDatabaseMock()
      mockKyselyInstance.schema.createTable.mockImplementation(() => {
        throw new Error('DDL generation failed')
      })

      await expect(migrate.diff(mockKyselyInstance as any, './test-schema.prisma')).rejects.toThrow(
        'Failed to generate migration diff',
      )
    })
  })

  describe('validate', () => {
    it('should validate schema against database', async () => {
      // Test case 1: Empty database with schema should be invalid (needs migration)
      mockKyselyInstance = KyselyMockFactory.createEmptyDatabaseMock()

      const testSchema = `
        model User {
          id    Int     @id @default(autoincrement())
          name  String
          email String  @unique
        }
      `
      const isValid = await migrate.validate(mockKyselyInstance as any, testSchema)

      expect(typeof isValid).toBe('boolean')
      expect(isValid).toBe(false) // Should be false because database is empty but schema has User model
    })

    it('should validate matching schema and database', async () => {
      // Test case 2: Database matches schema should be valid
      mockKyselyInstance = KyselyMockFactory.createEmptyDatabaseMock()

      const emptySchema = `
        // Empty schema
      `
      const isValid = await migrate.validate(mockKyselyInstance as any, emptySchema)

      expect(typeof isValid).toBe('boolean')
      expect(isValid).toBe(true) // Should be true because both database and schema are empty
    })

    it('should handle validation errors', async () => {
      mockKyselyInstance = KyselyMockFactory.createDatabaseErrorMock(new Error('Validation failed'))

      await expect(migrate.validate(mockKyselyInstance as any, './test-schema.prisma')).rejects.toThrow(
        'Failed to validate schema',
      )
    })
  })

  describe('Migration Summaries and Previews', () => {
    it('should generate detailed migration preview', async () => {
      mockKyselyInstance = KyselyMockFactory.createEmptyDatabaseMock()

      const testSchema = `
        model User {
          id    Int     @id @default(autoincrement())
          name  String
          email String  @unique
        }
      `

      const preview = await migrate.generateMigrationPreview(mockKyselyInstance as any, testSchema)

      expect(preview).toBeDefined()
      expect(preview.summary).toBeDefined()
      expect(preview.statements).toBeDefined()
      expect(preview.description).toBeDefined()
      expect(preview.riskAssessment).toBeDefined()
      expect(preview.rollbackInfo).toBeDefined()

      expect(preview.riskAssessment.level).toMatch(/^(low|medium|high)$/)
      expect(Array.isArray(preview.riskAssessment.factors)).toBe(true)
      expect(Array.isArray(preview.riskAssessment.recommendations)).toBe(true)
    })

    it('should generate migration warnings for common pitfalls', async () => {
      const mockDiff: any = {
        statements: [
          'ALTER TABLE users ADD COLUMN age INTEGER NOT NULL',
          'DROP TABLE old_table',
          'CREATE INDEX idx_email ON users (email)',
        ],
        summary: {
          tablesCreated: [],
          tablesModified: ['users'],
          tablesDropped: ['old_table'],
          columnsAdded: [{ table: 'users', column: 'age' }],
          columnsModified: [],
          columnsDropped: [],
          indexesCreated: ['idx_email'],
          indexesDropped: [],
        },
        hasDestructiveChanges: true,
        impact: {
          riskLevel: 'high',
          estimatedDuration: '1-5 minutes',
          warnings: [],
          tablesAffected: ['users', 'old_table'],
        },
      }

      mockKyselyInstance = KyselyMockFactory.createMockWithUserTable()

      const warnings = await migrate.generateMigrationWarnings(mockKyselyInstance as any, mockDiff)

      expect(Array.isArray(warnings)).toBe(true)
      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings.some((w) => w.includes('NOT NULL'))).toBe(true)
    })

    it('should apply migration with confirmation and progress reporting', async () => {
      // Mock empty database to avoid migration lock issues
      mockKyselyInstance = KyselyMockFactory.createEmptyDatabaseMock()

      const testSchema = `// Empty schema` // No changes needed

      const promptConfig = {
        enabled: false, // Disable prompts for testing
        minimumRiskLevel: 'medium' as const,
        showDetailedSummary: false,
        requireExplicitConfirmation: false,
      }

      const loggingConfig = {
        level: 'info' as const,
        logStatements: false,
        logExecutionTimes: false,
        logProgress: false,
      }

      const result = await migrate.applyWithConfirmation(
        mockKyselyInstance as any,
        testSchema,
        promptConfig,
        loggingConfig,
      )

      expect(result.success).toBe(true)
      expect(typeof result.executionTime).toBe('number')
      expect(result.statementsExecuted).toBe(0) // No changes should result in 0 statements
    })

    it('should handle high-risk migrations with confirmation', async () => {
      // Mock a high-risk scenario
      mockKyselyInstance = KyselyMockFactory.createMockWithUserTable()

      const testSchema = `// Empty schema` // This will trigger table drops

      const promptConfig = {
        enabled: true,
        minimumRiskLevel: 'high' as const,
        showDetailedSummary: true,
        requireExplicitConfirmation: true,
      }

      const loggingConfig = {
        level: 'info' as const,
        logStatements: false,
        logExecutionTimes: false,
        logProgress: false,
      }

      const result = await migrate.applyWithConfirmation(
        mockKyselyInstance as any,
        testSchema,
        promptConfig,
        loggingConfig,
      )

      // Should be cancelled due to high risk and explicit confirmation requirement
      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('cancelled')
    })
  })
})
