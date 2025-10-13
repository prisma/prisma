/**
 * Complete integration test for the FieldTranslator system
 * Tests the entire pipeline from schema to generated code
 */

import { describe, it, expect } from 'vitest'
import {
  createFieldTranslator,
  detectDialect,
  transformationRegistry,
  FieldAnalyzer,
  ModelTransformationRegistry,
  generators
} from '../index.js'
import type { FieldAST, ModelAST } from '@refract/schema-parser'

describe('Complete FieldTranslator Integration', () => {
  const mockUserModel: ModelAST = {
    name: 'User',
    fields: [
      {
        name: 'id',
        fieldType: 'Int',
        isOptional: false,
        isList: false,
        attributes: [{ name: 'id', args: [] }]
      },
      {
        name: 'email',
        fieldType: 'String',
        isOptional: false,
        isList: false,
        attributes: []
      },
      {
        name: 'isActive',
        fieldType: 'Boolean',
        isOptional: true,
        isList: false,
        attributes: []
      },
      {
        name: 'profile',
        fieldType: 'Json',
        isOptional: true,
        isList: false,
        attributes: []
      },
      {
        name: 'createdAt',
        fieldType: 'DateTime',
        isOptional: false,
        isList: false,
        attributes: []
      }
    ],
    attributes: []
  }

  describe('End-to-End Pipeline', () => {
    it('should complete full analysis pipeline for SQLite', () => {
      const translator = createFieldTranslator('sqlite')
      const metadata = translator.analyzeModel(mockUserModel)
      
      expect(metadata.modelName).toBe('User')
      expect(metadata.tableName).toBe('User')
      expect(metadata.dialect).toBe('sqlite')
      expect(metadata.fields.size).toBe(5)

      // Verify boolean field analysis
      const isActiveField = metadata.fields.get('isActive')
      expect(isActiveField).toBeDefined()
      expect(isActiveField!.columnType).toBe('INTEGER')
      expect(isActiveField!.specialHandling).toContain('nullable')
      
      const createTransform = isActiveField!.transformations.get('create')
      expect(createTransform?.code).toBe('data.isActive ? 1 : 0')
      
      const selectTransform = isActiveField!.transformations.get('select')
      expect(selectTransform?.code).toBe('data.isActive === 1')
    })

    it('should complete full analysis pipeline for PostgreSQL', () => {
      const translator = createFieldTranslator('postgresql')
      const metadata = translator.analyzeModel(mockUserModel)
      
      expect(metadata.dialect).toBe('postgresql')

      // PostgreSQL should handle booleans natively
      const isActiveField = metadata.fields.get('isActive')
      expect(isActiveField!.columnType).toBe('BOOLEAN')
      
      const createTransform = isActiveField!.transformations.get('create')
      expect(createTransform?.code).toBe('data.isActive')
    })

    it('should handle DateTime fields correctly across dialects', () => {
      const sqliteTranslator = createFieldTranslator('sqlite')
      const postgresTranslator = createFieldTranslator('postgresql')
      
      const sqliteMetadata = sqliteTranslator.analyzeModel(mockUserModel)
      const postgresMetadata = postgresTranslator.analyzeModel(mockUserModel)
      
      const sqliteDateTime = sqliteMetadata.fields.get('createdAt')!
      const postgresDateTime = postgresMetadata.fields.get('createdAt')!
      
      // SQLite stores dates as TEXT
      expect(sqliteDateTime.columnType).toBe('TEXT')
      // PostgreSQL uses proper timestamp
      expect(postgresDateTime.columnType).toBe('TIMESTAMP WITH TIME ZONE')
      
      // SQLite should convert on select
      const sqliteSelect = sqliteDateTime.transformations.get('select')
      expect(sqliteSelect?.code).toContain('new Date(')
      
      // PostgreSQL driver handles it
      const postgresSelect = postgresDateTime.transformations.get('select')
      expect(postgresSelect?.code).toBe('data.createdAt')
    })

    it('should handle JSON fields correctly across dialects', () => {
      const sqliteTranslator = createFieldTranslator('sqlite')
      const postgresTranslator = createFieldTranslator('postgresql')
      
      const sqliteMetadata = sqliteTranslator.analyzeModel(mockUserModel)
      const postgresMetadata = postgresTranslator.analyzeModel(mockUserModel)
      
      const sqliteJson = sqliteMetadata.fields.get('profile')!
      const postgresJson = postgresMetadata.fields.get('profile')!
      
      // Different column types
      expect(sqliteJson.columnType).toBe('TEXT')
      expect(postgresJson.columnType).toBe('JSONB')
      
      // SQLite needs JSON parsing
      const sqliteSelect = sqliteJson.transformations.get('select')
      expect(sqliteSelect?.code).toContain('JSON.parse(')
      
      // PostgreSQL JSONB is automatic
      const postgresSelect = postgresJson.transformations.get('select')
      expect(postgresSelect?.code).toBe('data.profile')
    })
  })

  describe('Registry and Model Management', () => {
    it('should manage multiple models in registry', () => {
      const registry = new ModelTransformationRegistry()
      const translator = createFieldTranslator('sqlite')
      
      const userMetadata = translator.analyzeModel(mockUserModel)
      registry.register(userMetadata)
      
      expect(registry.getAllModels()).toHaveLength(1)
      expect(registry.getModel('User')).toBeDefined()
      
      const stats = registry.getStats()
      expect(stats.modelCount).toBe(1)
      expect(stats.fieldCount).toBe(5)
      expect(stats.dialect).toBe('sqlite')
    })

    it('should retrieve specific field transformations', () => {
      const registry = new ModelTransformationRegistry()
      const translator = createFieldTranslator('mysql')
      
      const metadata = translator.analyzeModel(mockUserModel)
      registry.register(metadata)
      
      const boolTransform = registry.getFieldTransformation('User', 'isActive', 'create')
      expect(boolTransform?.code).toBe('data.isActive ? 1 : 0')
      
      const hasSpecialHandling = registry.hasSpecialHandling('User', 'isActive', 'nullable')
      expect(hasSpecialHandling).toBe(true)
    })
  })

  describe('Performance and Error Handling', () => {
    it('should provide performance metadata for all transformations', () => {
      const translator = createFieldTranslator('sqlite')
      const metadata = translator.analyzeModel(mockUserModel)
      
      for (const [fieldName, fieldData] of metadata.fields) {
        for (const [operation, transform] of fieldData.transformations) {
          expect(transform.performance).toBeDefined()
          expect(transform.performance.complexity).toMatch(/simple|moderate|complex/)
          expect(typeof transform.performance.inlinable).toBe('boolean')
          expect(transform.performance.impact).toMatch(/negligible|low|medium|high/)
        }
      }
    })

    it('should handle unsupported field types gracefully', () => {
      const translator = createFieldTranslator('sqlite')
      
      const unsupportedField: FieldAST = {
        name: 'weird',
        fieldType: 'UnsupportedType' as any,
        isOptional: false,
        isList: false,
        attributes: []
      }
      
      // FieldAnalyzer logs warnings but continues gracefully
      const result = translator.analyzeField(unsupportedField)
      expect(result.transformations.size).toBe(0) // No transformations generated
    })

    it('should provide error handling metadata', () => {
      const translator = createFieldTranslator('sqlite')
      const metadata = translator.analyzeModel(mockUserModel)
      
      // DateTime transformations need error handling
      const dateTimeField = metadata.fields.get('createdAt')!
      const createTransform = dateTimeField.transformations.get('create')!
      expect(createTransform.needsErrorHandling).toBe(true)
      
      // Simple string transformations don't
      const stringField = metadata.fields.get('email')!
      const stringTransform = stringField.transformations.get('create')!
      expect(stringTransform.needsErrorHandling).toBe(false)
    })
  })

  describe('Code Generation Quality', () => {
    it('should generate executable JavaScript code', () => {
      const translator = createFieldTranslator('sqlite')
      const metadata = translator.analyzeModel(mockUserModel)
      
      // Test that generated code is valid JavaScript
      const boolField = metadata.fields.get('isActive')!
      const createTransform = boolField.transformations.get('create')!
      
      // Should be able to evaluate as valid JavaScript expression
      const testCode = createTransform.code.replace('data.isActive', 'true')
      expect(eval(testCode)).toBe(1)
      
      const testCode2 = createTransform.code.replace('data.isActive', 'false')
      expect(eval(testCode2)).toBe(0)
    })

    it('should generate zero-import transformations for basic types', () => {
      const translator = createFieldTranslator('postgresql')
      const metadata = translator.analyzeModel(mockUserModel)
      
      for (const [fieldName, fieldData] of metadata.fields) {
        for (const [operation, transform] of fieldData.transformations) {
          // Most basic transformations should require zero imports
          if (transform.performance.complexity === 'simple') {
            expect(transform.imports).toEqual([])
          }
        }
      }
    })

    it('should generate contextually appropriate variable names', () => {
      const translator = createFieldTranslator('sqlite')
      const fieldResult = translator.analyzeField(mockUserModel.fields[1]) // email field
      
      const createTransform = fieldResult.transformations.get('create')!
      expect(createTransform.code).toContain('data.email')
      
      // Test different variable names
      const context = {
        field: mockUserModel.fields[1],
        dialect: 'sqlite' as const,
        operation: 'create' as const,
        variableName: 'input.email'
      }
      
      const customTransform = generators.sqlite.generateTransformation(context)
      expect(customTransform.code).toContain('input.email')
    })
  })

  describe('Dialect Detection Integration', () => {
    it('should work with all dialect detection methods', () => {
      // URL-based detection
      expect(detectDialect('postgres://localhost/test')).toBe('postgresql')
      expect(detectDialect('mysql://localhost/test')).toBe('mysql')
      expect(detectDialect('sqlite:./test.db')).toBe('sqlite')
      
      // Provider-based detection
      expect(detectDialect('postgresql')).toBe('postgresql')
      expect(detectDialect('mysql')).toBe('mysql')
      expect(detectDialect('sqlite')).toBe('sqlite')
      
      // Config-based detection
      const pgConfig = { database: { provider: 'postgresql' } }
      expect(detectDialect(pgConfig)).toBe('postgresql')
    })

    it('should create translators for detected dialects', () => {
      const dialect1 = detectDialect('postgres://localhost/test')
      const dialect2 = detectDialect('mysql://localhost/test')
      const dialect3 = detectDialect('sqlite:./test.db')
      
      const translator1 = createFieldTranslator(dialect1)
      const translator2 = createFieldTranslator(dialect2)
      const translator3 = createFieldTranslator(dialect3)
      
      expect(translator1).toBeDefined()
      expect(translator2).toBeDefined()
      expect(translator3).toBeDefined()
    })
  })
})