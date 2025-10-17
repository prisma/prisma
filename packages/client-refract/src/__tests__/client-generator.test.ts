/**
 * Tests for the client generator with FieldTranslator integration
 */

import { describe, it, expect } from 'vitest'
import { ClientGenerator } from '../client-generator.js'
import type { SchemaAST } from '@refract/schema-parser'

describe('ClientGenerator', () => {
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
    const generator = new ClientGenerator(mockSchema)
    const output = generator.generateClientModule()
    
    expect(output).toContain('Database dialect: sqlite')
    expect(output).toContain('Generated transformations with zero runtime overhead')
    
    // Should contain SQLite boolean transformations (? 1 : 0)
    expect(output).toContain('? 1 : 0')
    
    // Should contain DateTime transformations
    expect(output).toContain('toISOString()')
  })

  it('should generate client with PostgreSQL transformations when specified', () => {
    const generator = new ClientGenerator(mockSchema, {
      dialect: 'postgresql'
    })
    const output = generator.generateClientModule()
    
    expect(output).toContain('Database dialect: postgresql')
    
    // PostgreSQL doesn't need boolean transformation
    expect(output).not.toContain('? 1 : 0')
  })

  it('should generate client with MySQL transformations when specified', () => {
    const generator = new ClientGenerator(mockSchema, {
      dialect: 'mysql'
    })
    const output = generator.generateClientModule()
    
    expect(output).toContain('Database dialect: mysql')
    
    // MySQL uses TINYINT for booleans, so should have transformations
    expect(output).toContain('? 1 : 0')
  })

  it('should detect dialect from config', () => {
    const generator = new ClientGenerator(mockSchema, {
      config: {
        database: {
          provider: 'postgresql',
          url: 'postgresql://localhost/test'
        }
      }
    })
    const output = generator.generateClientModule()
    
    expect(output).toContain('Database dialect: postgresql')
  })

  it('should generate CRUD operations with transformations', () => {
    const generator = new ClientGenerator(mockSchema)
    const output = generator.generateClientModule()
    
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
    const generator = new ClientGenerator(mockSchema)
    const output = generator.generateClientModule()
    
    // Should auto-generate timestamps
    expect(output).toContain('Auto-generated createdAt timestamp')
    expect(output).toContain('new Date().toISOString()')
  })

  it('should generate client class with model operations', () => {
    const generator = new ClientGenerator(mockSchema)
    const output = generator.generateClientModule()
    
    expect(output).toContain('export class RefractClient extends RefractClientBase')
    expect(output).toContain('declare readonly user: UserOperations')
    expect(output).toContain('super(dialect, { modelFactory: createModelOperations })')
    expect(output).toContain('const createModelOperations = (kysely: Kysely<DatabaseSchema>) => ({')
  })

  it('should generate factory function', () => {
    const generator = new ClientGenerator(mockSchema)
    const output = generator.generateClientModule()

    expect(output).toContain('export function createRefractClient(dialect: Dialect): RefractClient')
  })

  it('should generate relation include types and logic', () => {
    const schemaWithRelations: SchemaAST = {
      models: [
        {
          name: 'User',
          fields: [
            {
              name: 'id',
              fieldType: 'Int',
              isOptional: false,
              isList: false,
              attributes: [{ name: 'id', args: [], type: 'Attribute', span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } } }],
              type: 'Field',
              span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }
            },
            {
              name: 'name',
              fieldType: 'String',
              isOptional: false,
              isList: false,
              attributes: [],
              type: 'Field',
              span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }
            },
            {
              name: 'posts',
              fieldType: 'Post',
              isOptional: false,
              isList: true,
              attributes: [],
              type: 'Field',
              span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }
            }
          ],
          attributes: [],
          type: 'Model',
          span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }
        },
        {
          name: 'Post',
          fields: [
            {
              name: 'id',
              fieldType: 'Int',
              isOptional: false,
              isList: false,
              attributes: [{ name: 'id', args: [], type: 'Attribute', span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } } }],
              type: 'Field',
              span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }
            },
            {
              name: 'title',
              fieldType: 'String',
              isOptional: false,
              isList: false,
              attributes: [],
              type: 'Field',
              span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }
            },
            {
              name: 'userId',
              fieldType: 'Int',
              isOptional: false,
              isList: false,
              attributes: [],
              type: 'Field',
              span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }
            },
            {
              name: 'user',
              fieldType: 'User',
              isOptional: false,
              isList: false,
              attributes: [
                {
                  name: 'relation',
                  args: [
                    {
                      name: 'fields',
                      value: ['userId'],
                      type: 'AttributeArgument',
                      span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }
                    },
                    {
                      name: 'references',
                      value: ['id'],
                      type: 'AttributeArgument',
                      span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }
                    }
                  ],
                  type: 'Attribute',
                  span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }
                }
              ],
              type: 'Field',
              span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }
            }
          ],
          attributes: [],
          type: 'Model',
          span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }
        }
      ],
      enums: [],
      generators: [],
      datasources: [],
      type: 'Schema',
      span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }
    }

    const generator = new ClientGenerator(schemaWithRelations)
    const output = generator.generateClientModule()

    // Should generate include types
    expect(output).toContain('export interface PostInclude')
    expect(output).toContain('user?: boolean')

    // Should include include parameter in operations
    expect(output).toContain('include?: PostInclude')

    // Should generate join logic
    expect(output).toContain('applyIncludes(')
    expect(output).toContain('leftJoin')
    expect(output).toContain('transformSelectResultWithIncludes(')

    // Should handle relation transformation
    expect(output).toContain('relations.find')
  })
})
