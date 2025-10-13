/**
 * Integration tests for the FieldTranslator system
 */

import { describe, it, expect } from 'vitest'
import {
  createFieldTranslator,
  transformationRegistry,
  detectDialect,
  DialectDetector,
  generators
} from '../index.js'
import type { FieldAST } from '@refract/schema-parser'

describe('FieldTranslator Integration', () => {
  const mockStringField: FieldAST = {
    name: 'email',
    fieldType: 'String',
    isOptional: false,
    isList: false,
    attributes: []
  }

  const mockBooleanField: FieldAST = {
    name: 'isActive',
    fieldType: 'Boolean',
    isOptional: true,
    isList: false,
    attributes: []
  }

  const mockDateTimeField: FieldAST = {
    name: 'createdAt',
    fieldType: 'DateTime',
    isOptional: false,
    isList: false,
    attributes: [{ name: 'default', args: [{ value: 'now()' }] }]
  }

  describe('Dialect Detection', () => {
    it('should detect PostgreSQL from URL', () => {
      expect(detectDialect('postgresql://user:pass@localhost/db')).toBe('postgresql')
      expect(detectDialect('postgres://user:pass@localhost/db')).toBe('postgresql')
    })

    it('should detect MySQL from URL', () => {
      expect(detectDialect('mysql://user:pass@localhost/db')).toBe('mysql')
    })

    it('should detect SQLite from URL', () => {
      expect(detectDialect('sqlite:./dev.db')).toBe('sqlite')
      expect(detectDialect('file:./test.sqlite')).toBe('sqlite')
    })

    it('should detect from provider names', () => {
      expect(DialectDetector.dialectFromProvider('postgresql')).toBe('postgresql')
      expect(DialectDetector.dialectFromProvider('mysql')).toBe('mysql')
      expect(DialectDetector.dialectFromProvider('sqlite')).toBe('sqlite')
    })

    it('should detect from Refract config', () => {
      const config = {
        database: {
          provider: 'postgresql',
          url: 'postgresql://localhost/test'
        }
      }
      expect(detectDialect(config)).toBe('postgresql')
    })
  })

  describe('SQLite Transformations', () => {
    const analyzer = createFieldTranslator('sqlite')

    it('should generate Boolean transformations', () => {
      const result = analyzer.analyzeField(mockBooleanField)
      
      const createTransform = result.transformations.get('create')
      expect(createTransform?.code).toBe('data.isActive ? 1 : 0')
      
      const selectTransform = result.transformations.get('select')
      expect(selectTransform?.code).toBe('data.isActive === 1')
    })

    it('should generate DateTime transformations', () => {
      const result = analyzer.analyzeField(mockDateTimeField)
      
      const createTransform = result.transformations.get('create')
      expect(createTransform?.code).toContain('toISOString()')
      
      const selectTransform = result.transformations.get('select')
      expect(selectTransform?.code).toBe('new Date(data.createdAt)')
    })

    it('should detect special handling', () => {
      const result = analyzer.analyzeField(mockBooleanField)
      expect(result.specialHandling).toContain('nullable')
    })
  })

  describe('PostgreSQL Transformations', () => {
    const analyzer = createFieldTranslator('postgresql')

    it('should generate Boolean transformations', () => {
      const result = analyzer.analyzeField(mockBooleanField)
      
      // PostgreSQL supports native booleans - no transformation needed
      const createTransform = result.transformations.get('create')
      expect(createTransform?.code).toBe('data.isActive')
      
      const selectTransform = result.transformations.get('select')
      expect(selectTransform?.code).toBe('data.isActive')
    })

    it('should get correct column types', () => {
      const result = analyzer.analyzeField(mockBooleanField)
      expect(result.columnType).toBe('BOOLEAN')
    })
  })

  describe('MySQL Transformations', () => {
    const analyzer = createFieldTranslator('mysql')

    it('should generate Boolean transformations', () => {
      const result = analyzer.analyzeField(mockBooleanField)
      
      const createTransform = result.transformations.get('create')
      expect(createTransform?.code).toBe('data.isActive ? 1 : 0')
      
      const selectTransform = result.transformations.get('select')
      expect(selectTransform?.code).toBe('data.isActive === 1')
    })

    it('should get correct column types', () => {
      const result = analyzer.analyzeField(mockBooleanField)
      expect(result.columnType).toBe('TINYINT(1)')
    })
  })

  describe('Registry System', () => {
    it('should have all generators registered', () => {
      expect(transformationRegistry.getSupportedDialects()).toEqual([
        'sqlite', 'postgresql', 'mysql'
      ])
    })

    it('should generate transformations through registry', () => {
      const context = {
        field: mockStringField,
        dialect: 'sqlite' as const,
        operation: 'create' as const,
        variableName: 'data.email'
      }

      const result = transformationRegistry.generateTransformation('sqlite', context)
      expect(result.code).toBe('String(data.email)')
    })
  })

  describe('Performance Characteristics', () => {
    it('should mark simple transformations correctly', () => {
      const analyzer = createFieldTranslator('sqlite')
      const result = analyzer.analyzeField(mockStringField)
      
      const createTransform = result.transformations.get('create')
      expect(createTransform?.performance.complexity).toBe('simple')
      expect(createTransform?.performance.inlinable).toBe(true)
      expect(createTransform?.performance.impact).toBe('negligible')
    })

    it('should mark complex transformations correctly', () => {
      const analyzer = createFieldTranslator('sqlite')
      const result = analyzer.analyzeField(mockDateTimeField)
      
      const createTransform = result.transformations.get('create')
      expect(createTransform?.performance.complexity).toBe('moderate')
      expect(createTransform?.needsErrorHandling).toBe(true)
    })
  })
})