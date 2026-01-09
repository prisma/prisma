import { vi } from 'vitest'

/**
 * Comprehensive Kysely mock factory using real Kysely structure
 * Uses importOriginal pattern to maintain type safety while providing controllable behavior
 */
export class KyselyMockFactory {
  // Static property to control current mock instance for importOriginal pattern
  static currentMockInstance: any = null
  /**
   * Create a full Kysely instance mock with all necessary methods
   * This method creates a mock that maintains Kysely's fluent API structure
   */
  static createKyselyMock(options: {
    /** Tables returned by introspection */
    tables?: Array<{
      name: string
      columns?: Array<{
        name: string
        dataType: string
        isNullable: boolean
        hasDefaultValue?: boolean
        isAutoIncrementing?: boolean
        comment?: string
      }>
      schema?: string
      isView?: boolean
    }>
    /** Whether introspection should fail */
    introspectionShouldFail?: boolean
    /** Error to throw on introspection failure */
    introspectionError?: Error
  } = {}): any {
    const { 
      tables = [], 
      introspectionShouldFail = false, 
      introspectionError = new Error('Database error') 
    } = options

    // Create chainable query builder
    const createChainableQuery = () => {
      const chainableQuery = {
        selectAll: vi.fn(() => chainableQuery),
        orderBy: vi.fn(() => chainableQuery),
        where: vi.fn(() => chainableQuery),
        execute: vi.fn().mockResolvedValue([]),
      }
      return chainableQuery
    }

    // Create chainable table builder for CREATE TABLE operations
    const createTableBuilder = (tableName: string) => {
      const tableBuilder = {
        addColumn: vi.fn((name: string, type: string, callback?: any) => {
          const columnBuilder = {
            notNull: vi.fn(() => columnBuilder),
            primaryKey: vi.fn(() => columnBuilder),
            defaultTo: vi.fn(() => columnBuilder),
          }
          if (callback) callback(columnBuilder)
          return tableBuilder
        }),
        compile: vi.fn(() => ({ sql: `CREATE TABLE "${tableName}" (...)` })),
        execute: vi.fn().mockResolvedValue({}),
      }
      return tableBuilder
    }

    // Create ALTER TABLE builder
    const createAlterTableBuilder = (tableName: string) => ({
      addColumn: vi.fn((name: string, type: string, callback?: any) => {
        const columnBuilder = {
          notNull: vi.fn(() => columnBuilder),
          defaultTo: vi.fn(() => columnBuilder),
        }
        if (callback) callback(columnBuilder)
        return {
          compile: vi.fn(() => ({ sql: `ALTER TABLE "${tableName}" ADD COLUMN ${name} ${type}` })),
          execute: vi.fn().mockResolvedValue({}),
        }
      }),
      dropColumn: vi.fn((name: string) => ({
        compile: vi.fn(() => ({ sql: `ALTER TABLE "${tableName}" DROP COLUMN ${name}` })),
        execute: vi.fn().mockResolvedValue({})
      })),
      alterColumn: vi.fn((name: string, callback?: any) => {
        const columnBuilder = {
          setDataType: vi.fn(() => columnBuilder),
          setNotNull: vi.fn(() => columnBuilder),
          dropNotNull: vi.fn(() => columnBuilder),
        }
        if (callback) callback(columnBuilder)
        return {
          compile: vi.fn(() => ({ sql: `ALTER TABLE "${tableName}" ALTER COLUMN ${name}` })),
          execute: vi.fn().mockResolvedValue({}),
        }
      }),
    })

    // Create the main mock object
    const mock = {
      introspection: {
        getTables: introspectionShouldFail 
          ? vi.fn().mockRejectedValue(introspectionError)
          : vi.fn().mockResolvedValue(tables.map(table => ({
              name: table.name,
              columns: table.columns || [],
              schema: table.schema,
              isView: table.isView || false,
            }))),
        getColumns: vi.fn().mockResolvedValue([]),
      },
      schema: {
        createTable: vi.fn((tableName: string) => createTableBuilder(tableName)),
        alterTable: vi.fn((tableName: string) => createAlterTableBuilder(tableName)),
        dropTable: vi.fn((tableName: string) => ({
          compile: vi.fn(() => ({ sql: `DROP TABLE "${tableName}"` })),
          execute: vi.fn().mockResolvedValue({}),
        })),
        createIndex: vi.fn((indexName: string) => ({
          on: vi.fn(() => ({
            column: vi.fn(() => ({
              compile: vi.fn(() => ({ sql: `CREATE INDEX "${indexName}" ...` })),
              execute: vi.fn().mockResolvedValue({}),
            })),
          })),
        })),
        dropIndex: vi.fn((name: string) => ({
          compile: vi.fn(() => ({ sql: `DROP INDEX "${name}"` })),
          execute: vi.fn().mockResolvedValue({}),
        })),
      },
      selectFrom: vi.fn(() => createChainableQuery()),
      insertInto: vi.fn(() => ({
        values: vi.fn(() => ({
          execute: vi.fn().mockResolvedValue({}),
        })),
      })),
      deleteFrom: vi.fn(() => ({
        where: vi.fn(() => ({
          where: vi.fn(() => ({
            execute: vi.fn().mockResolvedValue({}),
          })),
          execute: vi.fn().mockResolvedValue({}),
        })),
      })),
      transaction: vi.fn(() => ({
        execute: vi.fn((callback) => {
          // Create a transaction mock that passes itself to the callback
          const trxMock = {
            ...mock,
            executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
          }
          return callback(trxMock)
        }),
      })),
      executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
      raw: vi.fn(() => ({
        compile: vi.fn(() => ({ sql: 'RAW SQL' })),
      })),
    }

    return mock
  }

  /**
   * Create a mock for empty database (no tables)
   */
  static createEmptyDatabaseMock() {
    return this.createKyselyMock({ tables: [] })
  }

  /**
   * Create an empty database mock using the spy wrapper approach
   */
  static createEmptyDatabaseSpyMock() {
    return this.createKyselySpyWrapper({ 
      introspectionResults: [] 
    })
  }

  /**
   * Create a mock with migration history table
   */
  static createMockWithMigrationTable() {
    return this.createKyselyMock({
      tables: [
        {
          name: '_refract_migrations',
          columns: [
            { name: 'id', dataType: 'varchar(255)', isNullable: false },
            { name: 'name', dataType: 'varchar(255)', isNullable: false },
            { name: 'checksum', dataType: 'varchar(255)', isNullable: false },
            { name: 'appliedAt', dataType: 'timestamp', isNullable: false },
            { name: 'executionTime', dataType: 'integer', isNullable: false },
            { name: 'success', dataType: 'boolean', isNullable: false },
            { name: 'statements', dataType: 'text', isNullable: true },
            { name: 'dependencies', dataType: 'text', isNullable: true },
            { name: 'schemaVersion', dataType: 'varchar(255)', isNullable: true },
            { name: 'rollbackStatements', dataType: 'text', isNullable: true },
            { name: 'rollbackChecksum', dataType: 'varchar(255)', isNullable: true },
            { name: 'canRollback', dataType: 'boolean', isNullable: true },
            { name: 'rollbackWarnings', dataType: 'text', isNullable: true },
          ],
        },
      ],
    })
  }

  /**
   * Create a mock for database error scenarios
   */
  static createDatabaseErrorMock(error = new Error('Database error')) {
    return this.createKyselyMock({ 
      introspectionShouldFail: true, 
      introspectionError: error 
    })
  }

  /**
   * Create a database error mock using the spy wrapper approach
   */
  static createDatabaseErrorSpyMock(error = new Error('Database error')) {
    return this.createKyselySpyWrapper({ 
      shouldFail: true, 
      error 
    })
  }

  /**
   * Create a mock with sample user table
   */
  static createMockWithUserTable() {
    return this.createKyselyMock({
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', dataType: 'integer', isNullable: false, isAutoIncrementing: true },
            { name: 'name', dataType: 'varchar(255)', isNullable: false },
            { name: 'email', dataType: 'varchar(255)', isNullable: false },
          ],
        },
      ],
    })
  }

  /**
   * Create a Kysely spy wrapper using the real Kysely instance structure
   * This maintains perfect type compatibility while allowing controllable behavior
   */
  static createKyselySpyWrapper(options: {
    /** Mock execution results */
    queryResults?: any[]
    /** Mock introspection results */
    introspectionResults?: any
    /** Whether operations should fail */
    shouldFail?: boolean
    /** Error to throw on failure */
    error?: Error
  } = {}) {
    const { 
      queryResults = [], 
      introspectionResults = [], 
      shouldFail = false, 
      error = new Error('Mock error') 
    } = options

    // Create a proxy that maintains Kysely's fluent API behavior
    const createFluentProxy = (baseMethods: Record<string, any> = {}): any => {
      return new Proxy(baseMethods, {
        get(target, prop: string | symbol) {
          if (typeof prop === 'symbol') return (target as any)[prop]
          
          // If the method exists in our base methods, use it
          if (prop in target) {
            return target[prop]
          }

          // For unknown methods, create a chainable spy that returns the proxy itself
          const spy = vi.fn()
          
          // Determine what this method should return
          if (prop === 'execute' || prop === 'executeQuery') {
            spy.mockImplementation(() => 
              shouldFail ? Promise.reject(error) : Promise.resolve(queryResults)
            )
          } else if (prop === 'compile') {
            spy.mockReturnValue({ sql: 'MOCK SQL', parameters: [] })
          } else {
            // Most methods are chainable, return the proxy
            spy.mockReturnValue(createFluentProxy())
          }

          target[prop] = spy
          return spy
        }
      })
    }

    // Create the main Kysely-like mock object
    const baseMethods = {
      // Schema operations
      schema: createFluentProxy({
        createTable: vi.fn(() => createFluentProxy()),
        alterTable: vi.fn(() => createFluentProxy()),
        dropTable: vi.fn(() => createFluentProxy()),
        createIndex: vi.fn(() => createFluentProxy()),
        dropIndex: vi.fn(() => createFluentProxy()),
      }),

      // Query operations
      selectFrom: vi.fn(() => createFluentProxy()),
      insertInto: vi.fn(() => createFluentProxy()),
      updateTable: vi.fn(() => createFluentProxy()),
      deleteFrom: vi.fn(() => createFluentProxy()),
      
      // Raw and transaction operations
      raw: vi.fn(() => createFluentProxy()),
      transaction: vi.fn((callback) => {
        const trxProxy = createFluentProxy({ ...baseMethods })
        return callback ? callback(trxProxy) : trxProxy
      }),

      // Introspection
      introspection: {
        getTables: shouldFail 
          ? vi.fn().mockRejectedValue(error)
          : vi.fn().mockResolvedValue(introspectionResults),
        getColumns: vi.fn().mockResolvedValue([]),
        getIndexes: vi.fn().mockResolvedValue([]),
      },

      // Execution methods
      executeQuery: shouldFail 
        ? vi.fn().mockRejectedValue(error) 
        : vi.fn().mockResolvedValue({ rows: queryResults }),
      execute: shouldFail 
        ? vi.fn().mockRejectedValue(error) 
        : vi.fn().mockResolvedValue(queryResults),
    }

    return createFluentProxy(baseMethods)
  }

  /**
   * Set the current mock instance for importOriginal pattern
   */
  static setCurrentMockInstance(mockInstance: any) {
    this.currentMockInstance = mockInstance
  }

  /**
   * Clear the current mock instance
   */
  static clearCurrentMockInstance() {
    this.currentMockInstance = null
  }

  /**
   * Reset all mocks to their initial state
   */
  static resetAllMocks(mockInstance: any) {
    // Reset all vi.fn() calls recursively
    const resetMockRecursively = (obj: any) => {
      for (const key in obj) {
        if (typeof obj[key] === 'function' && obj[key]._isMockFunction) {
          obj[key].mockReset()
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          resetMockRecursively(obj[key])
        }
      }
    }
    resetMockRecursively(mockInstance)
  }
}

/**
 * Schema AST mock factory to eliminate duplication
 */
export class SchemaASTMockFactory {
  /**
   * Create a basic schema AST mock
   */
  static createBasicSchema(options: {
    models?: Array<{
      name: string
      fields: Array<{
        name: string
        type: string
        isOptional?: boolean
        attributes?: Array<{ name: string; args?: any[] }>
      }>
    }>
    enums?: Array<{
      name: string
      values: Array<{ name: string; attributes?: any[] }>
    }>
  } = {}) {
    const { models = [], enums = [] } = options

    return {
      errors: [],
      ast: {
        type: 'Schema',
        datasources: [],
        models: models.map(model => ({
          type: 'Model',
          name: model.name,
          fields: model.fields.map(field => ({
            type: 'Field',
            name: field.name,
            fieldType: field.type,
            isOptional: field.isOptional || false,
            isList: field.type.endsWith('[]'),
            attributes: field.attributes || [],
          })),
          attributes: [],
        })),
        enums: enums.map(enumDef => ({
          type: 'Enum',
          name: enumDef.name,
          values: enumDef.values,
        })),
      },
    }
  }

  /**
   * Create an empty schema
   */
  static createEmptySchema() {
    return this.createBasicSchema({ models: [], enums: [] })
  }

  /**
   * Create a User model schema
   */
  static createUserSchema() {
    return this.createBasicSchema({
      models: [
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'Int', attributes: [{ name: 'id' }] },
            { name: 'name', type: 'String' },
            { name: 'email', type: 'String', attributes: [{ name: 'unique' }] },
          ],
        },
      ],
    })
  }
}

// Mock Kysely using importOriginal to maintain real structure with controllable behavior
vi.mock('kysely', async (importOriginal: () => Promise<typeof import('kysely')>) => {
  const original = await importOriginal()
  
  return {
    ...original,
    Kysely: vi.fn().mockImplementation(() => {
      // Return the current mock instance set by factory methods
      return KyselyMockFactory.currentMockInstance || KyselyMockFactory.createEmptyDatabaseSpyMock()
    })
  }
})
