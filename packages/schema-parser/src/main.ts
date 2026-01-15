/**
 * Main entry point for schema parsing
 */

import { existsSync, readFileSync, statSync } from 'node:fs'

import { resolve } from 'path'

import { parseSchemaWithChevrotain } from './parser'
import type { ParseResult } from './types'

/**
 * Parse a Prisma schema from string content or file path(s)
 *
 * @param input - The Prisma schema content as a string, file path, or array of strings/file paths
 * @param options - Parse options
 * @returns ParseResult containing the AST and any errors
 *
 * @example
 * ```typescript
 * // Parse schema content directly
 * const result1 = parseSchema(`
 *   model User {
 *     id Int @id
 *     name String
 *   }
 * `)
 *
 * // Parse from file path
 * const result2 = parseSchema('./schema.prisma')
 *
 * // Parse multiple files
 * const result3 = parseSchema(['./base.prisma', './models.prisma'])
 *
 * // Mix file paths and schema content
 * const result4 = parseSchema([
 *   './base.prisma',
 *   'model Extra { id Int @id }'
 * ])
 * ```
 */
export function parseSchema(input: string | string[]): ParseResult {
  const parseInput = Array.isArray(input) ? input : [input]

  const schemaContent = parseInput
    .map((item) => {
      try {
        existsSync(item) && statSync(item).isFile()
        return readFileSync(resolve(item), 'utf-8')
      } catch {
        return item // If it fails, treat as schema content
      }
    })
    .join('\n\n')

  try {
    return parseSchemaWithChevrotain(schemaContent)
  } catch (error) {
    return {
      ast: {
        type: 'Schema',
        span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
        datasources: [],
        generators: [],
        models: [],
        types: [],
        views: [],
        enums: [],
      },
      errors: [
        {
          message: error instanceof Error ? error.message : 'Unknown parsing error',
          span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
          severity: 'error',
        },
      ],
    }
  }
}
