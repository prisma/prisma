/**
 * Integration test to verify FieldTranslator system works correctly
 */

import { describe, it, expect } from 'vitest'
import { 
  createFieldTranslator, 
  detectDialect, 
  generators,
  transformationRegistry 
} from '@refract/field-translator'
import type { FieldAST } from '@refract/schema-parser'

describe('FieldTranslator Integration in Client Generator', () => {
  const mockBooleanField: FieldAST = {
    name: 'isActive',
    fieldType: 'Boolean',
    isOptional: false,
    isList: false,
    attributes: []
  }

  const mockDateTimeField: FieldAST = {
    name: 'createdAt',
    fieldType: 'DateTime',
    isOptional: false,
    isList: false,
    attributes: []
  }

  it('should create field translator for different dialects', () => {
    const sqliteTranslator = createFieldTranslator('sqlite')
    const postgresTranslator = createFieldTranslator('postgresql')
    const mysqlTranslator = createFieldTranslator('mysql')

    expect(sqliteTranslator).toBeDefined()
    expect(postgresTranslator).toBeDefined()
    expect(mysqlTranslator).toBeDefined()
  })

  it('should generate different transformations for different dialects', () => {
    const sqliteTranslator = createFieldTranslator('sqlite')
    const postgresTranslator = createFieldTranslator('postgresql')

    const sqliteResult = sqliteTranslator.analyzeField(mockBooleanField)
    const postgresResult = postgresTranslator.analyzeField(mockBooleanField)

    const sqliteCreateTransform = sqliteResult.transformations.get('create')
    const postgresCreateTransform = postgresResult.transformations.get('create')

    // SQLite should transform booleans to 0/1
    expect(sqliteCreateTransform?.code).toContain('? 1 : 0')
    
    // PostgreSQL should pass booleans through unchanged
    expect(postgresCreateTransform?.code).toBe('data.isActive')
  })

  it('should handle DateTime transformations differently per dialect', () => {
    const sqliteTranslator = createFieldTranslator('sqlite')
    const postgresTranslator = createFieldTranslator('postgresql')

    const sqliteResult = sqliteTranslator.analyzeField(mockDateTimeField)
    const postgresResult = postgresTranslator.analyzeField(mockDateTimeField)

    const sqliteSelectTransform = sqliteResult.transformations.get('select')
    const postgresSelectTransform = postgresResult.transformations.get('select')

    // SQLite should convert from ISO string
    expect(sqliteSelectTransform?.code).toContain('new Date(')
    
    // PostgreSQL driver handles dates automatically
    expect(postgresSelectTransform?.code).toBe('data.createdAt')
  })

  it('should detect correct column types per dialect', () => {
    const sqliteTranslator = createFieldTranslator('sqlite')
    const postgresTranslator = createFieldTranslator('postgresql')
    const mysqlTranslator = createFieldTranslator('mysql')

    const sqliteResult = sqliteTranslator.analyzeField(mockBooleanField)
    const postgresResult = postgresTranslator.analyzeField(mockBooleanField)
    const mysqlResult = mysqlTranslator.analyzeField(mockBooleanField)

    expect(sqliteResult.columnType).toBe('INTEGER')
    expect(postgresResult.columnType).toBe('boolean')
    expect(mysqlResult.columnType).toBe('TINYINT(1)')
  })

  it('should detect special handling requirements', () => {
    const translator = createFieldTranslator('sqlite')
    
    const optionalField: FieldAST = {
      name: 'email',
      fieldType: 'String',
      isOptional: true,
      isList: false,
      attributes: []
    }

    const result = translator.analyzeField(optionalField)
    expect(result.specialHandling).toContain('nullable')
  })

  it('should provide performance metadata', () => {
    const translator = createFieldTranslator('sqlite')
    const result = translator.analyzeField(mockBooleanField)
    
    const createTransform = result.transformations.get('create')
    expect(createTransform?.performance).toBeDefined()
    expect(createTransform?.performance.complexity).toBe('simple')
    expect(createTransform?.performance.inlinable).toBe(true)
    expect(createTransform?.performance.impact).toBe('negligible')
  })

  it('should detect dialect from configuration', () => {
    expect(detectDialect('postgresql://localhost/test')).toBe('postgresql')
    expect(detectDialect('mysql://localhost/test')).toBe('mysql')
    expect(detectDialect('sqlite:./test.db')).toBe('sqlite')
    
    expect(detectDialect({ database: { provider: 'postgresql' } })).toBe('postgresql')
  })

  it('should have all generators registered', () => {
    expect(transformationRegistry.getSupportedDialects()).toEqual([
      'sqlite', 'postgresql', 'mysql'
    ])
    
    const sqliteGen = transformationRegistry.getGenerator('sqlite')
    const postgresGen = transformationRegistry.getGenerator('postgresql')
    const mysqlGen = transformationRegistry.getGenerator('mysql')
    
    expect(sqliteGen).toBeDefined()
    expect(postgresGen).toBeDefined()
    expect(mysqlGen).toBeDefined()
  })

  it('should generate inline transformation code', () => {
    const translator = createFieldTranslator('sqlite')
    const result = translator.analyzeField(mockBooleanField)
    
    const createTransform = result.transformations.get('create')
    
    // Should be actual executable JavaScript code
    expect(createTransform?.code).toBe('data.isActive ? 1 : 0')
    expect(createTransform?.imports).toEqual([])
    expect(createTransform?.needsErrorHandling).toBe(false)
  })
})