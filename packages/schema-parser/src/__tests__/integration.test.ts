/**
 * Comprehensive integration tests for Ork Schema Parser
 * Tests the complete pipeline: Chevrotain lexing -> parsing -> AST -> TypeScript codegen
 */

import { describe, expect, test } from 'vitest'

import { CodeGenerator } from '../codegen.js'
import { parseSchema } from '../main.js'

describe('Schema Parser Integration Tests', () => {
  describe('Basic Model Parsing', () => {
    test('should parse simple models with scalar fields', () => {
      const schema = `
        model User {
          id    Int     @id
          name  String
          age   Int?
          tags  String[]
        }
      `

      const result = parseSchema(schema)

      expect(result.errors).toHaveLength(0)
      expect(result.ast.models).toHaveLength(1)

      const user = result.ast.models[0]
      expect(user.name).toBe('User')
      expect(user.fields).toHaveLength(4)

      // Test field properties
      expect(user.fields[0]).toMatchObject({
        name: 'id',
        fieldType: 'Int',
        isOptional: false,
        isList: false,
      })

      expect(user.fields[2]).toMatchObject({
        name: 'age',
        fieldType: 'Int',
        isOptional: true,
        isList: false,
      })

      expect(user.fields[3]).toMatchObject({
        name: 'tags',
        fieldType: 'String',
        isOptional: false,
        isList: true,
      })
    })

    test('should parse enums correctly', () => {
      const schema = `
        enum Status {
          ACTIVE
          INACTIVE @deprecated
        }
        
        model User {
          id     Int    @id
          status Status
        }
      `

      const result = parseSchema(schema)

      expect(result.errors).toHaveLength(0)
      expect(result.ast.enums).toHaveLength(1)
      expect(result.ast.models).toHaveLength(1)

      const status = result.ast.enums[0]
      expect(status.name).toBe('Status')
      expect(status.values).toHaveLength(2)
      expect(status.values[1].attributes).toHaveLength(1)
      expect(status.values[1].attributes[0].name).toBe('deprecated')
    })
  })

  describe('One-to-Many Relations', () => {
    test('should parse basic one-to-many relations', () => {
      const schema = `
        model User {
          id    Int    @id
          name  String
          posts Post[]
        }

        model Post {
          id     Int    @id
          title  String
          userId Int
          user   User   @relation(fields: [userId], references: [id])
        }
      `

      const result = parseSchema(schema)

      expect(result.errors).toHaveLength(0)
      expect(result.ast.models).toHaveLength(2)

      const user = result.ast.models.find((m) => m.name === 'User')!
      const post = result.ast.models.find((m) => m.name === 'Post')!

      // Test User.posts field (one-to-many side)
      const postsField = user.fields.find((f) => f.name === 'posts')!
      expect(postsField).toMatchObject({
        name: 'posts',
        fieldType: 'Post',
        isList: true,
        isOptional: false,
      })

      // Test Post.user field (many-to-one side)
      const userField = post.fields.find((f) => f.name === 'user')!
      expect(userField).toMatchObject({
        name: 'user',
        fieldType: 'User',
        isList: false,
        isOptional: false,
      })

      // Test @relation attribute with array arguments
      const relationAttr = userField.attributes.find((a) => a.name === 'relation')!
      expect(relationAttr).toBeTruthy()
      expect(relationAttr.args).toHaveLength(2)

      const fieldsArg = relationAttr.args.find((a) => a.name === 'fields')!
      const referencesArg = relationAttr.args.find((a) => a.name === 'references')!

      expect(fieldsArg.value).toEqual(['userId'])
      expect(referencesArg.value).toEqual(['id'])
    })

    test('should parse named relations with optional fields', () => {
      const schema = `
        model Category {
          id    Int    @id
          name  String
          posts Post[] @relation("CategoryPosts")
        }

        model Post {
          id         Int       @id
          title      String
          categoryId Int?
          category   Category? @relation("CategoryPosts", fields: [categoryId], references: [id])
        }
      `

      const result = parseSchema(schema)

      expect(result.errors).toHaveLength(0)

      const post = result.ast.models.find((m) => m.name === 'Post')!
      const categoryField = post.fields.find((f) => f.name === 'category')!

      expect(categoryField.isOptional).toBe(true)
      expect(categoryField.fieldType).toBe('Category')

      const relationAttr = categoryField.attributes[0]
      expect(relationAttr.name).toBe('relation')
      expect(relationAttr.args).toHaveLength(3)

      // First argument should be the relation name
      expect(relationAttr.args[0].value).toBe('CategoryPosts')
      expect(relationAttr.args[0].name).toBeUndefined() // Positional argument
    })
  })

  describe('TypeScript Code Generation', () => {
    test('should generate proper TypeScript interfaces for models', () => {
      const schema = `
        model User {
          id       Int      @id
          name     String
          email    String?
          tags     String[]
          isActive Boolean  @default(true)
        }
      `

      const parseResult = parseSchema(schema)
      expect(parseResult.errors).toHaveLength(0)

      const generator = new CodeGenerator({ target: 'typescript', includeComments: true })
      const code = generator.generateCode(parseResult.ast)

      expect(code.interfaces).toContain('export interface User {')
      expect(code.interfaces).toContain('id: number')
      expect(code.interfaces).toContain('name: string')
      expect(code.interfaces).toContain('email?: string')
      expect(code.interfaces).toContain('tags: string[]')
      expect(code.interfaces).toContain('isActive: boolean')
    })

    test('should generate proper TypeScript interfaces for relations', () => {
      const schema = `
        model User {
          id    Int    @id
          posts Post[]
        }

        model Post {
          id   Int  @id
          user User @relation(fields: [userId], references: [id])
          userId Int
        }
      `

      const parseResult = parseSchema(schema)
      expect(parseResult.errors).toHaveLength(0)

      const generator = new CodeGenerator({ target: 'typescript' })
      const code = generator.generateCode(parseResult.ast)

      // Check User interface includes Post[] relation
      expect(code.interfaces).toContain('posts: Post[]')

      // Check Post interface includes User relation
      expect(code.interfaces).toContain('user: User')
    })

    test('should generate enum types correctly', () => {
      const schema = `
        enum UserStatus {
          ACTIVE
          INACTIVE
          BANNED
        }
        
        model User {
          id     Int        @id
          status UserStatus
        }
      `

      const parseResult = parseSchema(schema)
      expect(parseResult.errors).toHaveLength(0)

      const generator = new CodeGenerator({ target: 'typescript' })
      const code = generator.generateCode(parseResult.ast)

      expect(code.types).toContain('export enum UserStatus {')
      expect(code.types).toContain("ACTIVE = 'ACTIVE'")
      expect(code.types).toContain("INACTIVE = 'INACTIVE'")
      expect(code.types).toContain("BANNED = 'BANNED'")

      // Check model uses enum type
      expect(code.interfaces).toContain('status: UserStatus')
    })
  })

  describe('Schema Configuration', () => {
    test('should parse datasource and generator blocks', () => {
      const schema = `
        generator client {
          provider = "ork"
          output   = "./generated/client"
        }

        datasource db {
          provider = "postgresql"
          url      = env("DATABASE_URL")
        }

        model User {
          id Int @id
        }
      `

      const result = parseSchema(schema)

      expect(result.errors).toHaveLength(0)
      expect(result.ast.generators).toHaveLength(1)
      expect(result.ast.datasources).toHaveLength(1)

      const generator = result.ast.generators[0]
      expect(generator.name).toBe('client')
      expect(generator.provider).toBe('ork')
      expect(generator.output).toBe('./generated/client')

      const datasource = result.ast.datasources[0]
      expect(datasource.name).toBe('db')
      expect(datasource.provider).toBe('postgresql')
      expect(datasource.url).toBe('env("DATABASE_URL")')
    })
  })

  describe('Error Handling', () => {
    test('should handle syntax errors gracefully', () => {
      const schema = `
        model User {
          id Int @id
          name String
        // Missing closing brace
      `

      const result = parseSchema(schema)

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].severity).toBe('error')
      expect(result.ast.models).toHaveLength(0) // Should return empty AST on error
    })

    test('should handle empty schema', () => {
      const result = parseSchema('')

      expect(result.errors).toHaveLength(0)
      expect(result.ast.models).toHaveLength(0)
      expect(result.ast.enums).toHaveLength(0)
      expect(result.ast.datasources).toHaveLength(0)
      expect(result.ast.generators).toHaveLength(0)
    })
  })

  describe('Composite Constraints', () => {
    test('should parse composite primary keys (@@id)', () => {
      const schema = `
        model UserTenant {
          userId   Int
          tenantId Int
          role     String
          @@id([userId, tenantId])
        }
      `

      const result = parseSchema(schema)

      expect(result.errors).toHaveLength(0)
      expect(result.ast.models).toHaveLength(1)

      const model = result.ast.models[0]
      expect(model.attributes).toHaveLength(1)

      const idAttr = model.attributes[0]
      expect(idAttr.name).toBe('id')
      expect(idAttr.args).toHaveLength(1)
      expect(idAttr.args[0].value).toEqual(['userId', 'tenantId'])
    })

    test('should parse composite unique constraints (@@unique)', () => {
      const schema = `
        model User {
          id       Int    @id
          email    String
          tenantId Int
          username String
          @@unique([email, tenantId])
          @@unique([username, tenantId], name: "unique_username_per_tenant")
        }
      `

      const result = parseSchema(schema)

      expect(result.errors).toHaveLength(0)

      const model = result.ast.models[0]
      expect(model.attributes).toHaveLength(2)

      const firstUnique = model.attributes[0]
      expect(firstUnique.name).toBe('unique')
      expect(firstUnique.args[0].value).toEqual(['email', 'tenantId'])

      const namedUnique = model.attributes[1]
      expect(namedUnique.args).toHaveLength(2)
      expect(namedUnique.args[0].value).toEqual(['username', 'tenantId'])
      expect(namedUnique.args[1].name).toBe('name')
      expect(namedUnique.args[1].value).toBe('unique_username_per_tenant')
    })

    test('should parse database indexes (@@index)', () => {
      const schema = `
        model Post {
          id        Int      @id
          title     String
          createdAt DateTime
          status    String
          authorId  Int
          @@index([createdAt])
          @@index([status, authorId], name: "status_author_idx")
        }
      `

      const result = parseSchema(schema)

      expect(result.errors).toHaveLength(0)

      const model = result.ast.models[0]
      expect(model.attributes).toHaveLength(2)

      const simpleIndex = model.attributes[0]
      expect(simpleIndex.name).toBe('index')
      expect(simpleIndex.args[0].value).toEqual(['createdAt'])

      const namedIndex = model.attributes[1]
      expect(namedIndex.args).toHaveLength(2)
      expect(namedIndex.args[0].value).toEqual(['status', 'authorId'])
      expect(namedIndex.args[1].name).toBe('name')
      expect(namedIndex.args[1].value).toBe('status_author_idx')
    })
  })

  describe('Complete Scalar Types', () => {
    test('should parse all Prisma scalar types', () => {
      const schema = `
        model DataTypes {
          id        Int      @id
          name      String
          count     BigInt
          price     Float
          precise   Decimal
          createdAt DateTime
          metadata  Json
          avatar    Bytes
          isActive  Boolean
        }
      `

      const result = parseSchema(schema)

      expect(result.errors).toHaveLength(0)

      const model = result.ast.models[0]
      const fieldTypes = model.fields.map((f) => f.fieldType)

      expect(fieldTypes).toEqual([
        'Int',
        'String',
        'BigInt',
        'Float',
        'Decimal',
        'DateTime',
        'Json',
        'Bytes',
        'Boolean',
      ])
    })

    test('should generate correct TypeScript types for all scalars', () => {
      const schema = `
        model DataTypes {
          id        Int      @id
          name      String
          count     BigInt
          price     Float
          precise   Decimal
          createdAt DateTime
          metadata  Json
          avatar    Bytes
          isActive  Boolean
        }
      `

      const parseResult = parseSchema(schema)
      expect(parseResult.errors).toHaveLength(0)

      const generator = new CodeGenerator({ target: 'typescript' })
      const code = generator.generateCode(parseResult.ast)

      expect(code.interfaces).toContain('id: number')
      expect(code.interfaces).toContain('name: string')
      expect(code.interfaces).toContain('count: bigint')
      expect(code.interfaces).toContain('price: number')
      expect(code.interfaces).toContain('precise: number') // Decimal maps to number
      expect(code.interfaces).toContain('createdAt: Date')
      expect(code.interfaces).toContain('metadata: any') // Json maps to any
      expect(code.interfaces).toContain('avatar: Buffer')
      expect(code.interfaces).toContain('isActive: boolean')
    })
  })

  describe('Default Value Variations', () => {
    test('should parse function-based default values', () => {
      const schema = `
        model User {
          id        String   @id @default(cuid())
          uuid      String   @default(uuid())
          createdAt DateTime @default(now())
          updatedAt DateTime @updatedAt
          custom    String   @default(dbgenerated("gen_random_uuid()"))
        }
      `

      const result = parseSchema(schema)

      expect(result.errors).toHaveLength(0)

      const model = result.ast.models[0]
      const idField = model.fields[0]
      const defaultAttr = idField.attributes.find((a) => a.name === 'default')
      expect(defaultAttr?.args[0].value).toBe('cuid()')

      const uuidField = model.fields[1]
      const uuidDefaultAttr = uuidField.attributes.find((a) => a.name === 'default')
      expect(uuidDefaultAttr?.args[0].value).toBe('uuid()')

      const customField = model.fields[4]
      const customDefaultAttr = customField.attributes.find((a) => a.name === 'default')
      expect(customDefaultAttr?.args[0].value).toBe('dbgenerated("gen_random_uuid()")')
    })

    test('should parse literal default values', () => {
      const schema = `
        model Config {
          id       Int     @id
          name     String  @default("default_name")
          count    Int     @default(0)
          isActive Boolean @default(true)
          rate     Float   @default(1.5)
        }
      `

      const result = parseSchema(schema)

      expect(result.errors).toHaveLength(0)

      const model = result.ast.models[0]

      const nameField = model.fields[1]
      const nameDefault = nameField.attributes.find((a) => a.name === 'default')
      expect(nameDefault?.args[0].value).toBe('default_name')

      const countField = model.fields[2]
      const countDefault = countField.attributes.find((a) => a.name === 'default')
      expect(countDefault?.args[0].value).toBe(0)

      const isActiveField = model.fields[3]
      const isActiveDefault = isActiveField.attributes.find((a) => a.name === 'default')
      expect(isActiveDefault?.args[0].value).toBe(true)
    })
  })

  describe('Self-Relations', () => {
    test('should parse self-referential relations', () => {
      const schema = `
        model User {
          id        Int    @id
          name      String
          managerId Int?
          manager   User?  @relation("UserManager", fields: [managerId], references: [id])
          reports   User[] @relation("UserManager")
        }
      `

      const result = parseSchema(schema)

      expect(result.errors).toHaveLength(0)

      const model = result.ast.models[0]
      expect(model.fields).toHaveLength(5)

      // Check manager field (many-to-one)
      const managerField = model.fields[3]
      expect(managerField.name).toBe('manager')
      expect(managerField.fieldType).toBe('User')
      expect(managerField.isOptional).toBe(true)

      const managerRelation = managerField.attributes.find((a) => a.name === 'relation')
      expect(managerRelation?.args[0].value).toBe('UserManager')

      // Check reports field (one-to-many)
      const reportsField = model.fields[4]
      expect(reportsField.name).toBe('reports')
      expect(reportsField.fieldType).toBe('User')
      expect(reportsField.isList).toBe(true)

      const reportsRelation = reportsField.attributes.find((a) => a.name === 'relation')
      expect(reportsRelation?.args[0].value).toBe('UserManager')
    })

    test('should parse tree structures with self-relations', () => {
      const schema = `
        model Category {
          id       Int        @id
          name     String
          parentId Int?
          parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id])
          children Category[] @relation("CategoryTree")
        }
      `

      const result = parseSchema(schema)

      expect(result.errors).toHaveLength(0)

      const model = result.ast.models[0]
      const parentField = model.fields.find((f) => f.name === 'parent')
      const childrenField = model.fields.find((f) => f.name === 'children')

      expect(parentField?.fieldType).toBe('Category')
      expect(parentField?.isOptional).toBe(true)
      expect(childrenField?.fieldType).toBe('Category')
      expect(childrenField?.isList).toBe(true)
    })
  })

  describe('Comments Support', () => {
    test('should handle single-line comments', () => {
      const schema = `
        // User management model
        model User {
          id   Int    @id // Primary key
          name String    // User's full name
        }
        // End of User model
      `

      const result = parseSchema(schema)

      expect(result.errors).toHaveLength(0)
      expect(result.ast.models).toHaveLength(1)
      expect(result.ast.models[0].name).toBe('User')
      expect(result.ast.models[0].fields).toHaveLength(2)
    })

    test('should handle multi-line comments', () => {
      const schema = `
        /*
         * Multi-line comment
         * about the User model
         */
        model User {
          id   Int    @id /* inline comment */
          name String
        }
      `

      const result = parseSchema(schema)

      expect(result.errors).toHaveLength(0)
      expect(result.ast.models).toHaveLength(1)
      expect(result.ast.models[0].fields).toHaveLength(2)
    })
  })

  describe('Error Recovery', () => {
    test('should handle multiple syntax errors gracefully', () => {
      const schema = `
        model User {
          id Int @id
          name String
        // Missing closing brace

        model Post {
          id Int @id
          invalidField InvalidType @invalidAttribute
          title String
        }
        
        invalid syntax here !!!
        
        model Comment {
          id Int @id
          content String
        }
      `

      const result = parseSchema(schema)

      expect(result.errors.length).toBeGreaterThan(0)
      // Should still attempt to parse valid parts
      expect(result.errors[0].severity).toBe('error')
    })

    test('should provide meaningful error messages', () => {
      const schema = `
        model User {
          id Int @id
          name String @unknown_attribute(invalid_syntax
        }
      `

      const result = parseSchema(schema)

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].message).toBeTruthy()
      expect(typeof result.errors[0].message).toBe('string')
    })
  })

  describe('Performance and Edge Cases', () => {
    test('should handle large schemas efficiently', () => {
      // Generate a schema with many models to test performance
      const models = Array.from(
        { length: 50 },
        (_, i) => `
        model User${i} {
          id   Int    @id
          name String
          ${i > 0 ? `user${i - 1}Id Int?` : ''}
          ${i > 0 ? `user${i - 1} User${i - 1}? @relation(fields: [user${i - 1}Id], references: [id])` : ''}
        }
      `,
      ).join('\n')

      const start = Date.now()
      const result = parseSchema(models)
      const duration = Date.now() - start

      expect(result.errors).toHaveLength(0)
      expect(result.ast.models).toHaveLength(50)
      expect(duration).toBeLessThan(1000) // Should parse in under 1 second
    })

    test('should handle complex relation attributes', () => {
      const schema = `
        model User {
          id       Int    @id
          posts    Post[] @relation("UserPosts")
          comments Comment[] @relation("UserComments")
        }

        model Post {
          id       Int       @id
          authorId Int
          author   User      @relation("UserPosts", fields: [authorId], references: [id])
          comments Comment[] @relation("PostComments")
        }

        model Comment {
          id       Int  @id
          userId   Int
          postId   Int
          user     User @relation("UserComments", fields: [userId], references: [id])
          post     Post @relation("PostComments", fields: [postId], references: [id])
        }
      `

      const result = parseSchema(schema)

      expect(result.errors).toHaveLength(0)
      expect(result.ast.models).toHaveLength(3)

      // Verify all relations are parsed correctly
      const user = result.ast.models.find((m) => m.name === 'User')!
      expect(user.fields.filter((f) => f.isList).length).toBe(2) // Two relation arrays

      const comment = result.ast.models.find((m) => m.name === 'Comment')!
      const relations = comment.fields.filter((f) => f.attributes.some((a) => a.name === 'relation'))
      expect(relations).toHaveLength(2) // Two @relation attributes
    })
  })
})
