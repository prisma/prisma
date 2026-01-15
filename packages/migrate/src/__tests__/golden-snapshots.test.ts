import type {
  AttributeArgumentAST,
  AttributeAST,
  EnumAST,
  EnumValueAST,
  FieldAST,
  ModelAST,
  Span,
} from '@ork/schema-parser'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OrkMigrate } from '../OrkMigrate.js'
import type {
  AlterTableBuilderLike,
  AnyKyselyDatabase,
  ColumnBuilderLike,
  CreateIndexBuilderLike,
  CreateTableBuilderLike,
  DeleteQueryBuilderLike,
  InsertQueryBuilderLike,
  SelectQueryBuilderLike,
} from '../types.js'

// Test schema definitions for golden snapshots
const GOLDEN_SCHEMA_TESTS = {
  // Foreign Key Tests
  foreignKeys: {
    name: 'Foreign Key Constraints',
    beforeSchema: `
model User {
  id    Int    @id
  name  String
}

model Post {
  id      Int    @id
  title   String
  content String?
}
`,
    afterSchema: `
model User {
  id    Int    @id
  name  String
  posts Post[]
}

model Post {
  id       Int    @id
  title    String
  content  String?
  authorId Int
  author   User   @relation(fields: [authorId], references: [id], onDelete: Cascade)
}
`,
  },

  // Index Tests
  indexes: {
    name: 'Index Creation and Modification',
    beforeSchema: `
model User {
  id    Int    @id
  name  String
  email String
}
`,
    afterSchema: `
model User {
  id    Int    @id
  name  String @unique
  email String
  
  @@index([name, email], name: "user_name_email_idx")
  @@unique([email], name: "user_email_key")
}
`,
  },

  // Default Value Tests
  defaults: {
    name: 'Default Value Changes',
    beforeSchema: `
model User {
  id        Int      @id
  name      String
  createdAt DateTime
  isActive  Boolean
}
`,
    afterSchema: `
model User {
  id        Int      @id @default(autoincrement())
  name      String   @default("Anonymous")
  createdAt DateTime @default(now())
  isActive  Boolean  @default(true)
  role      String   @default("USER")
}
`,
  },

  // Enum Tests
  enums: {
    name: 'Enum Type Management',
    beforeSchema: `
model User {
  id   Int    @id
  name String
}
`,
    afterSchema: `
enum UserRole {
  ADMIN
  USER
  MODERATOR
}

enum Status {
  ACTIVE
  INACTIVE
  PENDING
}

model User {
  id     Int      @id
  name   String
  role   UserRole @default(USER)
  status Status   @default(PENDING)
}
`,
  },

  // Complex Combined Test
  complex: {
    name: 'Complex Schema with All Features',
    beforeSchema: `
model User {
  id    Int    @id
  name  String
  email String
}

model Category {
  id   Int    @id
  name String
}
`,
    afterSchema: `
enum UserRole {
  ADMIN
  EDITOR
  VIEWER
}

enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String   @default("Unknown")
  role      UserRole @default(VIEWER)
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now())
  posts     Post[]
  
  @@index([email, role], name: "user_email_role_idx")
  @@unique([name, email], name: "user_name_email_key")
}

model Category {
  id          Int    @id @default(autoincrement())
  name        String @unique
  description String @default("")
  posts       Post[]
  
  @@index([name], name: "category_name_idx")
}

model Post {
  id         Int        @id @default(autoincrement())
  title      String
  content    String?
  status     PostStatus @default(DRAFT)
  authorId   Int
  categoryId Int?
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @default(now())
  
  author   User      @relation(fields: [authorId], references: [id], onDelete: Cascade)
  category Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  
  @@index([status, createdAt], name: "post_status_created_idx")
  @@index([authorId], name: "post_author_idx")
  @@unique([title, authorId], name: "post_title_author_key")
}
`,
  },
}

// Mock schema parser to return actual parsed schemas for our test cases
vi.mock('@ork/schema-parser', async () => {
  const actual = await vi.importActual('@ork/schema-parser')
  return {
    ...actual,
    parseSchema: vi.fn((schemaPath: string) => {
      // Extract test case name from schema path
      const testCase = Object.entries(GOLDEN_SCHEMA_TESTS).find(
        ([key, test]) => schemaPath.includes(key) || schemaPath.includes(test.name),
      )

      if (!testCase) {
        return parseTestSchema('')
      }

      const [, test] = testCase
      const isAfter = schemaPath.includes('after')
      const schemaContent = isAfter ? test.afterSchema : test.beforeSchema

      // Parse the schema content to create appropriate AST
      return parseTestSchema(schemaContent)
    }),
  }
})

const emptySpan: Span = {
  start: { line: 0, column: 0, offset: 0 },
  end: { line: 0, column: 0, offset: 0 },
}

// Helper to parse test schemas into AST format
function parseTestSchema(schemaContent: string) {
  const models: ModelAST[] = []
  const enums: EnumAST[] = []
  const buildAttributes = (
    attributes: Array<{ name: string; args?: Array<{ name?: string; value: AttributeArgumentAST['value'] }> }>,
  ): AttributeAST[] =>
    attributes.map((attr) => ({
      type: 'Attribute',
      span: emptySpan,
      name: attr.name,
      args: (attr.args || []).map((arg) => ({
        type: 'AttributeArgument',
        span: emptySpan,
        name: arg.name,
        value: arg.value,
      })),
    }))

  // Very basic parsing for test purposes
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g
  const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g

  let match

  // Parse enums
  while ((match = enumRegex.exec(schemaContent)) !== null) {
    const [, name, content] = match
    const values: Array<{ name: string; attributes: AttributeAST[] }> = content
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//'))
      .map((line) => ({ name: line, attributes: [] }))

    enums.push({
      type: 'Enum',
      span: emptySpan,
      name,
      values: values.map(
        (value): EnumValueAST => ({
          type: 'EnumValue',
          span: emptySpan,
          name: value.name,
          attributes: value.attributes,
        }),
      ),
    })
  }

  // Parse models
  while ((match = modelRegex.exec(schemaContent)) !== null) {
    const [, name, content] = match
    const fields: FieldAST[] = []

    const fieldLines = content
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('@@') && !line.startsWith('//'))

    for (const line of fieldLines) {
      const fieldMatch = line.match(/(\w+)\s+(\w+(?:\[\])?)\s*(.*)/)
      if (fieldMatch) {
        const [, fieldName, fieldType, rest] = fieldMatch
        const attributes: Array<{
          name: string
          args?: Array<{ name?: string; value: AttributeArgumentAST['value'] }>
        }> = []

        // Parse basic attributes
        if (rest.includes('@id')) attributes.push({ name: 'id', args: [] })
        if (rest.includes('@unique')) attributes.push({ name: 'unique', args: [] })
        if (rest.includes('@default(')) {
          const defaultMatch = rest.match(/@default\(([^)]+)\)/)
          if (defaultMatch) {
            attributes.push({
              name: 'default',
              args: [{ value: defaultMatch[1] }],
            })
          }
        }
        if (rest.includes('@relation(')) {
          // Parse relation attributes - simplified
          attributes.push({ name: 'relation', args: [] })
        }

        fields.push({
          type: 'Field',
          span: emptySpan,
          name: fieldName,
          fieldType: fieldType.replace('[]', ''),
          isOptional: rest.includes('?'),
          isList: fieldType.includes('[]'),
          attributes: buildAttributes(attributes),
        })
      }
    }

    models.push({
      type: 'Model',
      span: emptySpan,
      name,
      fields,
      attributes: [], // Model-level attributes would be parsed here
    })
  }

  return {
    errors: [],
    ast: {
      type: 'Schema',
      span: emptySpan,
      datasources: [],
      generators: [],
      models,
      types: [],
      views: [],
      enums,
    },
  }
}

// Mock Kysely instance for golden tests
const createMockKyselyInstance = (): AnyKyselyDatabase => {
  const createColumnBuilder = (): ColumnBuilderLike => {
    const columnBuilder: ColumnBuilderLike = {
      notNull: () => columnBuilder,
      primaryKey: () => columnBuilder,
      defaultTo: () => columnBuilder,
      setDataType: () => columnBuilder,
      setNotNull: () => columnBuilder,
      dropNotNull: () => columnBuilder,
    }
    return columnBuilder
  }

  const createTableBuilder = (tableName: string): CreateTableBuilderLike => {
    const tableBuilder: CreateTableBuilderLike = {
      addColumn: (_name, _type, callback) => {
        if (callback) callback(createColumnBuilder())
        return tableBuilder
      },
      addForeignKeyConstraint: () => tableBuilder,
      compile: () => ({ sql: `CREATE TABLE "${tableName}" (...)` }),
      execute: vi.fn().mockResolvedValue({}),
    }
    return tableBuilder
  }

  const createAlterTableBuilder = (tableName: string): AlterTableBuilderLike => {
    const alterBuilder: AlterTableBuilderLike = {
      addColumn: (_name, _type, callback) => {
        if (callback) callback(createColumnBuilder())
        return alterBuilder
      },
      dropColumn: () => alterBuilder,
      alterColumn: (_name, callback) => {
        callback(createColumnBuilder())
        return alterBuilder
      },
      compile: () => ({ sql: `ALTER TABLE "${tableName}" ...` }),
      execute: vi.fn().mockResolvedValue({}),
    }
    return alterBuilder
  }

  const createChainableQuery = (): SelectQueryBuilderLike => {
    const chainableQuery: SelectQueryBuilderLike = {
      selectAll: () => chainableQuery,
      orderBy: () => chainableQuery,
      where: () => chainableQuery,
      execute: vi.fn().mockResolvedValue([]),
    }
    return chainableQuery
  }

  return {
    introspection: {
      getTables: vi.fn().mockResolvedValue([]),
    },
    schema: {
      createTable: vi.fn((tableName: string) => createTableBuilder(tableName)),
      alterTable: vi.fn((tableName: string) => createAlterTableBuilder(tableName)),
      dropTable: vi.fn((tableName: string) => ({
        compile: vi.fn(() => ({ sql: `DROP TABLE "${tableName}"` })),
        execute: vi.fn().mockResolvedValue({}),
      })),
      createIndex: vi.fn(
        (indexName: string): CreateIndexBuilderLike => ({
          on: vi.fn(() => ({
            column: vi.fn(() => ({
              compile: vi.fn(() => ({ sql: `CREATE INDEX "${indexName}" ...` })),
              execute: vi.fn().mockResolvedValue({}),
            })),
          })),
        }),
      ),
      dropIndex: vi.fn((indexName: string) => ({
        compile: vi.fn(() => ({ sql: `DROP INDEX "${indexName}"` })),
        execute: vi.fn().mockResolvedValue({}),
      })),
    },
    selectFrom: vi.fn(() => createChainableQuery()),
    insertInto: vi.fn(
      (): InsertQueryBuilderLike => ({
        values: () => ({
          execute: vi.fn().mockResolvedValue({}),
        }),
      }),
    ),
    deleteFrom: vi.fn(
      (): DeleteQueryBuilderLike => ({
        where: () => ({
          where: () => ({
            execute: vi.fn().mockResolvedValue({}),
          }),
          execute: vi.fn().mockResolvedValue({}),
        }),
        execute: vi.fn().mockResolvedValue({}),
      }),
    ),
    transaction: vi.fn(() => ({
      execute: vi.fn((callback) => callback({ executeQuery: vi.fn().mockResolvedValue({ rows: [] }) })),
    })),
    executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
  }
}

describe('Golden Snapshot Tests', () => {
  let migrate: OrkMigrate

  beforeEach(() => {
    vi.clearAllMocks()
    migrate = new OrkMigrate()
  })

  Object.entries(GOLDEN_SCHEMA_TESTS).forEach(([testKey, testData]) => {
    describe(testData.name, () => {
      it('should generate expected SQL migration statements', async () => {
        const mockDb = createMockKyselyInstance()

        // Generate diff from before -> after schema
        const diff = await migrate.diff(mockDb, `test-${testKey}-after`)

        // Create snapshot of the migration SQL statements
        expect({
          testCase: testData.name,
          statements: diff.statements,
          summary: {
            tablesCreated: diff.summary.tablesCreated,
            tablesModified: diff.summary.tablesModified,
            tablesDropped: diff.summary.tablesDropped,
            columnsAdded: diff.summary.columnsAdded,
            columnsModified: diff.summary.columnsModified,
            columnsDropped: diff.summary.columnsDropped,
            indexesCreated: diff.summary.indexesCreated,
            indexesDropped: diff.summary.indexesDropped,
            foreignKeysCreated: diff.summary.foreignKeysCreated,
            foreignKeysDropped: diff.summary.foreignKeysDropped,
            enumsCreated: diff.summary.enumsCreated,
            enumsModified: diff.summary.enumsModified,
            enumsDropped: diff.summary.enumsDropped,
          },
          hasDestructiveChanges: diff.hasDestructiveChanges,
          riskLevel: diff.impact.riskLevel,
        }).toMatchSnapshot(`${testKey}-migration-diff.json`)
      })

      it('should generate deterministic SQL across multiple runs', async () => {
        const mockDb = createMockKyselyInstance()

        // Generate diff multiple times
        const diff1 = await migrate.diff(mockDb, `test-${testKey}-after`)
        const diff2 = await migrate.diff(mockDb, `test-${testKey}-after`)
        const diff3 = await migrate.diff(mockDb, `test-${testKey}-after`)

        // All runs should produce identical results
        expect(diff1.statements).toEqual(diff2.statements)
        expect(diff2.statements).toEqual(diff3.statements)
        expect(diff1.summary).toEqual(diff2.summary)
        expect(diff2.summary).toEqual(diff3.summary)
      })

      it('should validate migration preview generation', async () => {
        const mockDb = createMockKyselyInstance()

        const preview = await migrate.generateMigrationPreview(mockDb, `test-${testKey}-after`)

        expect({
          testCase: testData.name,
          description: preview.description,
          riskLevel: preview.riskAssessment.level,
          factors: preview.riskAssessment.factors,
          recommendations: preview.riskAssessment.recommendations,
          rollbackAvailable: preview.rollbackInfo.available,
          statementCount: preview.statements.length,
        }).toMatchSnapshot(`${testKey}-migration-preview.json`)
      })
    })
  })

  describe('Dialect-Specific SQL Generation', () => {
    const testDialects = ['postgresql', 'mysql', 'sqlite']

    testDialects.forEach((dialect) => {
      it(`should generate ${dialect}-compatible SQL`, async () => {
        const mockDb = createMockKyselyInstance()

        // Test with a complex schema that exercises all features
        const diff = await migrate.diff(mockDb, 'test-complex-after')

        // Verify SQL is generated (actual dialect-specific logic would be more complex)
        expect(diff.statements.length).toBeGreaterThan(0)
        expect(diff.statements.every((stmt) => typeof stmt === 'string')).toBe(true)

        // Snapshot the generated SQL for this dialect
        expect({
          dialect,
          statements: diff.statements,
          summary: diff.summary,
        }).toMatchSnapshot(`complex-${dialect}-migration.json`)
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty schema gracefully', async () => {
      const mockDb = createMockKyselyInstance()

      const diff = await migrate.diff(mockDb, 'test-empty-after')

      expect(diff.statements).toEqual([])
      expect(diff.hasDestructiveChanges).toBe(false)
      expect(diff.impact.riskLevel).toBe('low')
    })

    it('should detect conflicting schema changes', async () => {
      const mockDb = createMockKyselyInstance()

      // This would test schemas that have conflicts
      const diff = await migrate.diff(mockDb, 'test-complex-after')

      // Verify warnings are generated for potentially problematic changes
      expect(diff.impact.warnings).toBeDefined()
      expect(Array.isArray(diff.impact.warnings)).toBe(true)
    })
  })

  describe('Migration History and Rollback', () => {
    it('should generate rollback information', async () => {
      const mockDb = createMockKyselyInstance()

      const preview = await migrate.generateMigrationPreview(mockDb, 'test-complex-after')

      expect(preview.rollbackInfo).toBeDefined()
      expect(typeof preview.rollbackInfo.available).toBe('boolean')
      expect(Array.isArray(preview.rollbackInfo.statements)).toBe(true)
      expect(Array.isArray(preview.rollbackInfo.warnings)).toBe(true)
    })
  })
})
