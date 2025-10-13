/**
 * Tests for Enhanced Client Generator with FieldTranslator integration
 */

import { describe, it, expect } from 'vitest'
import { EnhancedClientGeneratorWithTranslations } from '../enhanced-client-generator.js'
import type { SchemaAST } from '@refract/schema-parser'

describe('EnhancedClientGeneratorWithTranslations', () => {
  const mockSchema: SchemaAST = {
    models: [
      {
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
            isOptional: false,
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
    ],
    enums: [],
    generators: [],
    datasources: []
  }

  it('should generate client with SQLite transformations by default', () => {
    const generator = new EnhancedClientGeneratorWithTranslations(mockSchema)
    const output = generator.generateEnhancedClient()
    
    expect(output).toContain('Database dialect: sqlite')
    expect(output).toContain('Generated transformations with zero runtime overhead')
    
    // Should contain SQLite boolean transformations (? 1 : 0)
    expect(output).toContain('? 1 : 0')
    
    // Should contain DateTime transformations
    expect(output).toContain('toISOString()')
  })

  it('should generate client with PostgreSQL transformations when specified', () => {
    const generator = new EnhancedClientGeneratorWithTranslations(mockSchema, {
      dialect: 'postgresql'
    })
    const output = generator.generateEnhancedClient()
    
    expect(output).toContain('Database dialect: postgresql')
    
    // PostgreSQL doesn't need boolean transformation
    expect(output).not.toContain('? 1 : 0')
  })

  it('should generate client with MySQL transformations when specified', () => {
    const generator = new EnhancedClientGeneratorWithTranslations(mockSchema, {
      dialect: 'mysql'
    })
    const output = generator.generateEnhancedClient()
    
    expect(output).toContain('Database dialect: mysql')
    
    // MySQL uses TINYINT for booleans, so should have transformations
    expect(output).toContain('? 1 : 0')
  })

  it('should detect dialect from config', () => {
    const generator = new EnhancedClientGeneratorWithTranslations(mockSchema, {
      config: {
        database: {
          provider: 'postgresql',
          url: 'postgresql://localhost/test'
        }
      }
    })
    const output = generator.generateEnhancedClient()
    
    expect(output).toContain('Database dialect: postgresql')
  })

  it('should generate CRUD operations with transformations', () => {
    const generator = new EnhancedClientGeneratorWithTranslations(mockSchema)
    const output = generator.generateEnhancedClient()
    
    // Should have all CRUD operations
    expect(output).toContain('async findMany(')
    expect(output).toContain('async findUnique(')
    expect(output).toContain('async create(')
    expect(output).toContain('async update(')
    expect(output).toContain('async delete(')
    
    // Should have transformation methods
    expect(output).toContain('prepareCreateData(')
    expect(output).toContain('prepareUpdateData(')
    expect(output).toContain('transformSelectResult(')
    expect(output).toContain('transformWhereValue(')
  })

  it('should include timestamp logic', () => {
    const generator = new EnhancedClientGeneratorWithTranslations(mockSchema)
    const output = generator.generateEnhancedClient()
    
    // Should auto-generate timestamps
    expect(output).toContain('Auto-generated createdAt timestamp')
    expect(output).toContain('new Date().toISOString()')
  })

  it('should generate client class with model operations', () => {
    const generator = new EnhancedClientGeneratorWithTranslations(mockSchema)
    const output = generator.generateEnhancedClient()
    
    expect(output).toContain('export class RefractClient')
    expect(output).toContain('readonly user: UserOperations')
    expect(output).toContain('this.user = new UserOperations(this.$kysely)')
  })

  it('should generate factory function', () => {
    const generator = new EnhancedClientGeneratorWithTranslations(mockSchema)
    const output = generator.generateEnhancedClient()
    
    expect(output).toContain('export function createRefractClient(dialect: Dialect): RefractClient')
  })
})