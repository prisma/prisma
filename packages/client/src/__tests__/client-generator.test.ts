/**
 * Tests for the client generator with FieldTranslator integration
 */

import type { SchemaAST } from '@ork-orm/schema-parser'
import { describe, expect, it } from 'vitest'

import { ClientGenerator } from '../client-generator.js'

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
            attributes: [{ name: 'id', args: [] }],
          },
          {
            name: 'email',
            fieldType: 'String',
            isOptional: false,
            isList: false,
            attributes: [],
          },
          {
            name: 'isActive',
            fieldType: 'Boolean',
            isOptional: false,
            isList: false,
            attributes: [],
          },
          {
            name: 'createdAt',
            fieldType: 'DateTime',
            isOptional: false,
            isList: false,
            attributes: [],
          },
        ],
        attributes: [],
      },
    ],
    enums: [],
    generators: [],
    datasources: [],
  }

  it('should generate client with SQLite transformations by default', () => {
    const generator = new ClientGenerator(mockSchema)
    const output = generator.generateClientModule()

    expect(output).toContain('Database dialect: sqlite')

    // Should contain SQLite boolean transformations (? 1 : 0)
    expect(output).toContain('? 1 : 0')

    // Should contain DateTime transformations
    expect(output).toContain('toISOString()')
  })

  it('should generate client with PostgreSQL transformations when specified', () => {
    const generator = new ClientGenerator(mockSchema, {
      dialect: 'postgresql',
    })
    const output = generator.generateClientModule()

    expect(output).toContain('Database dialect: postgresql')

    // PostgreSQL doesn't need boolean transformation
    expect(output).not.toContain('? 1 : 0')
  })

  it('should generate client with MySQL transformations when specified', () => {
    const generator = new ClientGenerator(mockSchema, {
      dialect: 'mysql',
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
          url: 'postgresql://localhost/test',
        },
      },
    })
    const output = generator.generateClientModule()

    expect(output).toContain('Database dialect: postgresql')
  })

  it('should generate CRUD operations with transformations', () => {
    const generator = new ClientGenerator(mockSchema)
    const output = generator.generateClientModule()

    // Should have all CRUD operations
    expect(output).toContain('async findMany<T extends')
    expect(output).toContain('async findUnique<T extends')
    expect(output).toContain('async create(')
    expect(output).toContain('async update(')
    expect(output).toContain('async delete(')

    // Should have transformation methods
    expect(output).toContain('prepareCreateData(')
    expect(output).toContain('prepareUpdateData(')
    expect(output).toContain('transformSelectResult(')
    expect(output).toContain('transformWhereValue_')
  })

  it('should include timestamp logic', () => {
    const generator = new ClientGenerator(mockSchema)
    const output = generator.generateClientModule()

    // Should auto-generate timestamps
    expect(output).toContain(
      'prepared.createdAt = data.createdAt ? new Date(data.createdAt) : new Date().toISOString()',
    )
  })

  it('should generate client class with model operations', () => {
    const generator = new ClientGenerator(mockSchema)
    const output = generator.generateClientModule()

    expect(output).toContain('export class OrkClient extends OrkClientBase')
    expect(output).toContain('declare readonly user: UserOperations')
    expect(output).toContain('super(dialect, { modelFactory: createModelOperations, log: options?.log })')
    expect(output).toContain('const createModelOperations = (kysely: Kysely<DatabaseSchema>) => ({')
  })

  it('should generate factory function', () => {
    const generator = new ClientGenerator(mockSchema)
    const output = generator.generateClientModule()

    expect(output).toContain('export function createOrkClient(dialect: Dialect, options?: OrkClientOptions): OrkClient')
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
              attributes: [
                {
                  name: 'id',
                  args: [],
                  type: 'Attribute',
                  span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
                },
              ],
              type: 'Field',
              span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
            },
            {
              name: 'name',
              fieldType: 'String',
              isOptional: false,
              isList: false,
              attributes: [],
              type: 'Field',
              span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
            },
            {
              name: 'posts',
              fieldType: 'Post',
              isOptional: false,
              isList: true,
              attributes: [],
              type: 'Field',
              span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
            },
          ],
          attributes: [],
          type: 'Model',
          span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
        },
        {
          name: 'Post',
          fields: [
            {
              name: 'id',
              fieldType: 'Int',
              isOptional: false,
              isList: false,
              attributes: [
                {
                  name: 'id',
                  args: [],
                  type: 'Attribute',
                  span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
                },
              ],
              type: 'Field',
              span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
            },
            {
              name: 'title',
              fieldType: 'String',
              isOptional: false,
              isList: false,
              attributes: [],
              type: 'Field',
              span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
            },
            {
              name: 'userId',
              fieldType: 'Int',
              isOptional: false,
              isList: false,
              attributes: [],
              type: 'Field',
              span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
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
                      span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
                    },
                    {
                      name: 'references',
                      value: ['id'],
                      type: 'AttributeArgument',
                      span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
                    },
                  ],
                  type: 'Attribute',
                  span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
                },
              ],
              type: 'Field',
              span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
            },
          ],
          attributes: [],
          type: 'Model',
          span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
        },
      ],
      enums: [],
      generators: [],
      datasources: [],
      type: 'Schema',
      span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
    }

    const generator = new ClientGenerator(schemaWithRelations)
    const output = generator.generateClientModule()

    // Should generate include types
    expect(output).toContain('export interface PostInclude')
    expect(output).toContain('user?: boolean')

    // Should include include parameter in operations
    expect(output).toContain('include?: PostInclude')

    // Should generate include logic
    expect(output).toContain('.$if(')
    expect(output).toContain('jsonObjectFrom')
    expect(output).toContain('transformSelectResultWithIncludes(')

    // Should handle relation transformation
    expect(output).toContain('relations.find')
  })
})
