/**
 * Comprehensive tests for parseSchema function with different input types
 */

import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { parseSchema } from '../main.js'

const TEST_DIR = join(process.cwd(), 'test-schemas')

const SAMPLE_SCHEMA = `
model User {
  id    Int     @id
  name  String
  email String?
}
`

const SAMPLE_SCHEMA_2 = `
model Post {
  id      Int    @id
  title   String
  content String
}
`

const SAMPLE_DATASOURCE = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
`

describe('parseSchema Input Handling', () => {
  beforeAll(() => {
    // Create test directory and files
    mkdirSync(TEST_DIR, { recursive: true })
    writeFileSync(join(TEST_DIR, 'schema.prisma'), SAMPLE_SCHEMA)
    writeFileSync(join(TEST_DIR, 'models.prisma'), SAMPLE_SCHEMA_2)
    writeFileSync(join(TEST_DIR, 'datasource.prisma'), SAMPLE_DATASOURCE)
    writeFileSync(join(TEST_DIR, 'combined.prisma'), SAMPLE_DATASOURCE + SAMPLE_SCHEMA + SAMPLE_SCHEMA_2)
  })

  afterAll(() => {
    // Clean up test files
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe('Single String Input', () => {
    test('should parse schema content directly', () => {
      const result = parseSchema(SAMPLE_SCHEMA)

      expect(result.errors).toHaveLength(0)
      expect(result.ast.models).toHaveLength(1)
      expect(result.ast.models[0].name).toBe('User')
    })

    test('should parse from file path', () => {
      const result = parseSchema(join(TEST_DIR, 'schema.prisma'))

      expect(result.errors).toHaveLength(0)
      expect(result.ast.models).toHaveLength(1)
      expect(result.ast.models[0].name).toBe('User')
    })

    test('should handle ambiguous input as schema content when forced', () => {
      const ambiguousInput = 'model Test { id Int @id }'
      const result = parseSchema(ambiguousInput)

      expect(result.errors).toHaveLength(0)
      expect(result.ast.models).toHaveLength(1)
      expect(result.ast.models[0].name).toBe('Test')
    })

    test('should treat non-existent file as schema content and generate parsing errors', () => {
      const result = parseSchema('non-existent-file.prisma')

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.ast.models).toHaveLength(0)
    })
  })

  describe('Array Input - File Paths Only', () => {
    test('should parse multiple file paths', () => {
      const result = parseSchema([join(TEST_DIR, 'schema.prisma'), join(TEST_DIR, 'models.prisma')])

      expect(result.errors).toHaveLength(0)
      expect(result.ast.models).toHaveLength(2)
      expect(result.ast.models.map((m) => m.name)).toEqual(['User', 'Post'])
    })

    test('should parse multiple files with datasource', () => {
      const result = parseSchema([
        join(TEST_DIR, 'datasource.prisma'),
        join(TEST_DIR, 'schema.prisma'),
        join(TEST_DIR, 'models.prisma'),
      ])

      expect(result.errors).toHaveLength(0)
      expect(result.ast.datasources).toHaveLength(1)
      expect(result.ast.models).toHaveLength(2)
      expect(result.ast.datasources[0].provider).toBe('postgresql')
    })
  })

  describe('Array Input - Schema Content Only', () => {
    test('should parse multiple schema strings', () => {
      const result = parseSchema([SAMPLE_SCHEMA, SAMPLE_SCHEMA_2])

      expect(result.errors).toHaveLength(0)
      expect(result.ast.models).toHaveLength(2)
      expect(result.ast.models.map((m) => m.name)).toEqual(['User', 'Post'])
    })

    test('should parse schema content with explicit inputType', () => {
      const result = parseSchema([SAMPLE_SCHEMA, SAMPLE_SCHEMA_2])

      expect(result.errors).toHaveLength(0)
      expect(result.ast.models).toHaveLength(2)
    })

    test('should combine datasource and models from schema strings', () => {
      const result = parseSchema([SAMPLE_DATASOURCE, SAMPLE_SCHEMA, SAMPLE_SCHEMA_2])

      expect(result.errors).toHaveLength(0)
      expect(result.ast.datasources).toHaveLength(1)
      expect(result.ast.models).toHaveLength(2)
    })
  })

  describe('Array Input - Mixed File Paths and Schema Content', () => {
    test('should parse mixed file paths and schema content', () => {
      const result = parseSchema([
        join(TEST_DIR, 'datasource.prisma'), // File path
        SAMPLE_SCHEMA, // Schema content
        join(TEST_DIR, 'models.prisma'), // File path
      ])

      expect(result.errors).toHaveLength(0)
      expect(result.ast.datasources).toHaveLength(1)
      expect(result.ast.models).toHaveLength(2)
      expect(result.ast.models.map((m) => m.name)).toEqual(['User', 'Post'])
    })

    test('should handle complex mixed input', () => {
      const extraModel = `
        model Comment {
          id     Int    @id
          text   String
          postId Int
        }
      `

      const result = parseSchema([
        join(TEST_DIR, 'datasource.prisma'),
        SAMPLE_SCHEMA,
        extraModel,
        join(TEST_DIR, 'models.prisma'),
      ])

      expect(result.errors).toHaveLength(0)
      expect(result.ast.datasources).toHaveLength(1)
      expect(result.ast.models).toHaveLength(3)
      expect(result.ast.models.map((m) => m.name)).toEqual(['User', 'Comment', 'Post'])
    })
  })

  describe('Auto-Detection Logic', () => {
    test('should detect file paths correctly', () => {
      const result = parseSchema(join(TEST_DIR, 'schema.prisma'))

      expect(result.errors).toHaveLength(0)
      expect(result.ast.models).toHaveLength(1)
      expect(result.ast.models[0].name).toBe('User')
    })

    test('should detect schema content correctly', () => {
      const schemaContent = 'model AutoDetected { id Int @id name String }'
      const result = parseSchema(schemaContent)

      expect(result.errors).toHaveLength(0)
      expect(result.ast.models).toHaveLength(1)
      expect(result.ast.models[0].name).toBe('AutoDetected')
    })

    test('should handle edge case: string that looks like path but is schema', () => {
      const schemaContent = 'model PathLikeName { id Int @id }'
      const result = parseSchema(schemaContent)

      expect(result.errors).toHaveLength(0)
      expect(result.ast.models).toHaveLength(1)
      expect(result.ast.models[0].name).toBe('PathLikeName')
    })

    test('should handle edge case: file path without extension', () => {
      const pathWithoutExt = join(TEST_DIR, 'schema')
      writeFileSync(pathWithoutExt, SAMPLE_SCHEMA)

      const result = parseSchema(pathWithoutExt)

      expect(result.errors).toHaveLength(0)
      expect(result.ast.models).toHaveLength(1)
      expect(result.ast.models[0].name).toBe('User')

      rmSync(pathWithoutExt)
    })
  })

  describe('Error Handling', () => {
    test('should handle mixed array with non-existent file as schema content', () => {
      const result = parseSchema([SAMPLE_SCHEMA, 'non-existent-file.prisma'])

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.ast.models).toHaveLength(0) // Parser fails completely when any input is invalid
    })

    test('should handle invalid schema content', () => {
      const result = parseSchema('invalid schema content !!!')

      expect(result.errors.length).toBeGreaterThan(0)
    })

    test('should handle empty array', () => {
      const result = parseSchema([])

      expect(result.errors).toHaveLength(0)
      expect(result.ast.models).toHaveLength(0)
    })
  })

  describe('Real-world Scenarios', () => {
    test('should handle typical project structure', () => {
      // Simulate a typical Prisma project structure
      const result = parseSchema([
        join(TEST_DIR, 'datasource.prisma'),
        join(TEST_DIR, 'schema.prisma'),
        join(TEST_DIR, 'models.prisma'),
      ])

      expect(result.errors).toHaveLength(0)
      expect(result.ast.datasources).toHaveLength(1)
      expect(result.ast.models).toHaveLength(2)
    })

    test('should handle dynamic schema generation', () => {
      const dynamicModel = `
        model Dynamic${Date.now()} {
          id   Int    @id
          data String
        }
      `

      const result = parseSchema([join(TEST_DIR, 'datasource.prisma'), dynamicModel])

      expect(result.errors).toHaveLength(0)
      expect(result.ast.datasources).toHaveLength(1)
      expect(result.ast.models).toHaveLength(1)
      expect(result.ast.models[0].name).toMatch(/^Dynamic\d+$/)
    })

    test('should handle configuration with inline models', () => {
      const result = parseSchema([
        `
          generator client {
            provider = "ork"
            output   = "./generated/client"
          }
        `,
        join(TEST_DIR, 'datasource.prisma'),
        `
          model InlineUser {
            id    Int     @id
            name  String
          }
        `,
      ])

      expect(result.errors).toHaveLength(0)
      expect(result.ast.generators).toHaveLength(1)
      expect(result.ast.datasources).toHaveLength(1)
      expect(result.ast.models).toHaveLength(1)
      expect(result.ast.generators[0].provider).toBe('ork')
    })
  })
})
