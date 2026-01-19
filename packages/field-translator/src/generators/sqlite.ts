/**
 * SQLite Field Transformation Code Generator
 *
 * Generates build-time transformation code for SQLite-specific type mappings
 * including Boolean to 0/1 conversion, DateTime serialization, and JSON handling.
 *
 * All transformations produce inline code with zero runtime overhead.
 */

import type { FieldAST } from '@ork-orm/schema-parser'

import type {
  FieldTransformationGenerator,
  FieldTransformContext,
  GeneratedTransformation,
  TransformationOperation,
  TransformationPerformance,
} from '../types.js'
import { UnsupportedFieldTypeError } from '../types.js'

export class SQLiteTransformationGenerator implements FieldTransformationGenerator {
  readonly dialect = 'sqlite' as const

  generateTransformation(context: FieldTransformContext): GeneratedTransformation {
    const { field, operation, variableName } = context

    if (!this.supportsField(field)) {
      throw new UnsupportedFieldTypeError(field, this.dialect)
    }

    switch (field.fieldType) {
      case 'Boolean':
        return this.generateBooleanTransformation(operation, variableName)

      case 'DateTime':
        return this.generateDateTimeTransformation(operation, variableName, field)

      case 'Json':
        return this.generateJsonTransformation(operation, variableName)

      case 'Int':
      case 'BigInt':
        return this.generateIntegerTransformation(operation, variableName, field)

      case 'Float':
      case 'Decimal':
        return this.generateNumericTransformation(operation, variableName, field)

      case 'String':
        return this.generateStringTransformation(operation, variableName, field)

      default:
        throw new UnsupportedFieldTypeError(field, this.dialect)
    }
  }

  supportsField(field: FieldAST): boolean {
    const supportedTypes = ['Boolean', 'DateTime', 'Json', 'Int', 'BigInt', 'Float', 'Decimal', 'String']
    return supportedTypes.includes(field.fieldType)
  }

  getDatabaseColumnType(field: FieldAST): string {
    switch (field.fieldType) {
      case 'String':
        return 'TEXT'
      case 'Int':
        return 'INTEGER'
      case 'BigInt':
        return 'INTEGER'
      case 'Float':
      case 'Decimal':
        return 'REAL'
      case 'Boolean':
        return 'INTEGER' // SQLite uses INTEGER for booleans (0/1)
      case 'DateTime':
        return 'TEXT' // SQLite stores dates as ISO strings
      case 'Json':
        return 'TEXT' // SQLite stores JSON as TEXT
      default:
        return 'TEXT'
    }
  }

  private generateBooleanTransformation(
    operation: TransformationOperation,
    variableName: string,
  ): GeneratedTransformation {
    const transformations = {
      create: `${variableName} ? 1 : 0`,
      update: `${variableName} ? 1 : 0`,
      where: `${variableName} ? 1 : 0`,
      select: `${variableName} === 1`,
    }

    return {
      code: transformations[operation],
      imports: [],
      needsErrorHandling: false,
      performance: {
        complexity: 'simple',
        inlinable: true,
        impact: 'negligible',
      },
    }
  }

  private generateDateTimeTransformation(
    operation: TransformationOperation,
    variableName: string,
    field: FieldAST,
  ): GeneratedTransformation {
    const isOptional = field.isOptional

    const transformations = {
      create: isOptional
        ? `${variableName} ? (${variableName} instanceof Date ? ${variableName}.toISOString() : new Date(${variableName} as string | number).toISOString()) : null`
        : `${variableName} instanceof Date ? ${variableName}.toISOString() : new Date(${variableName} as string | number).toISOString()`,

      update: isOptional
        ? `${variableName} ? (${variableName} instanceof Date ? ${variableName}.toISOString() : new Date(${variableName} as string | number).toISOString()) : null`
        : `${variableName} instanceof Date ? ${variableName}.toISOString() : new Date(${variableName} as string | number).toISOString()`,

      where: isOptional
        ? `${variableName} ? (${variableName} instanceof Date ? ${variableName}.toISOString() : new Date(${variableName} as string | number).toISOString()) : null`
        : `${variableName} instanceof Date ? ${variableName}.toISOString() : new Date(${variableName} as string | number).toISOString()`,

      select: isOptional
        ? `${variableName} ? new Date(${variableName} as string | number) : null`
        : `new Date(${variableName} as string | number)`,
    }

    return {
      code: transformations[operation],
      imports: [],
      needsErrorHandling: operation !== 'select', // Date parsing can fail
      performance: {
        complexity: 'moderate',
        inlinable: true,
        impact: 'low',
      },
    }
  }

  private generateJsonTransformation(
    operation: TransformationOperation,
    variableName: string,
  ): GeneratedTransformation {
    const transformations = {
      create: `typeof ${variableName} === 'string' ? ${variableName} : JSON.stringify(${variableName})`,
      update: `typeof ${variableName} === 'string' ? ${variableName} : JSON.stringify(${variableName})`,
      where: `typeof ${variableName} === 'string' ? ${variableName} : JSON.stringify(${variableName})`,
      select: `JSON.parse(${variableName})`,
    }

    return {
      code: transformations[operation],
      imports: [],
      needsErrorHandling: operation === 'select', // JSON.parse can fail
      performance: {
        complexity: 'moderate',
        inlinable: true,
        impact: 'low',
      },
    }
  }

  private generateIntegerTransformation(
    operation: TransformationOperation,
    variableName: string,
    field: FieldAST,
  ): GeneratedTransformation {
    const isBigInt = field.fieldType === 'BigInt'
    const isOptional = field.isOptional

    if (operation === 'select') {
      // SQLite returns numbers as JS numbers
      if (isBigInt) {
        return {
          code: isOptional ? `${variableName} !== null ? BigInt(${variableName}) : null` : `BigInt(${variableName})`,
          imports: [],
          needsErrorHandling: false,
          performance: {
            complexity: 'simple',
            inlinable: true,
            impact: 'negligible',
          },
        }
      } else {
        return {
          code: variableName, // No transformation needed for regular integers
          imports: [],
          needsErrorHandling: false,
          performance: {
            complexity: 'simple',
            inlinable: true,
            impact: 'negligible',
          },
        }
      }
    }

    // For create/update/where operations
    if (isBigInt) {
      const transformation = isOptional
        ? `${variableName} !== null ? Number(${variableName}) : null`
        : `Number(${variableName})`

      return {
        code: transformation,
        imports: [],
        needsErrorHandling: true, // BigInt conversion can overflow
        performance: {
          complexity: 'simple',
          inlinable: true,
          impact: 'negligible',
        },
      }
    } else {
      const transformation = isOptional
        ? `${variableName} !== null ? Number(${variableName}) : null`
        : `Number(${variableName})`

      return {
        code: transformation,
        imports: [],
        needsErrorHandling: false,
        performance: {
          complexity: 'simple',
          inlinable: true,
          impact: 'negligible',
        },
      }
    }
  }

  private generateNumericTransformation(
    operation: TransformationOperation,
    variableName: string,
    field: FieldAST,
  ): GeneratedTransformation {
    const isOptional = field.isOptional

    if (operation === 'select') {
      // SQLite returns numbers as JS numbers, no transformation needed
      return {
        code: variableName,
        imports: [],
        needsErrorHandling: false,
        performance: {
          complexity: 'simple',
          inlinable: true,
          impact: 'negligible',
        },
      }
    }

    // For create/update/where operations, ensure it's a number
    const transformation = isOptional
      ? `${variableName} !== null ? Number(${variableName}) : null`
      : `Number(${variableName})`

    return {
      code: transformation,
      imports: [],
      needsErrorHandling: false,
      performance: {
        complexity: 'simple',
        inlinable: true,
        impact: 'negligible',
      },
    }
  }

  private generateStringTransformation(
    operation: TransformationOperation,
    variableName: string,
    field: FieldAST,
  ): GeneratedTransformation {
    const isOptional = field.isOptional

    if (operation === 'select') {
      // SQLite returns strings as-is
      return {
        code: variableName,
        imports: [],
        needsErrorHandling: false,
        performance: {
          complexity: 'simple',
          inlinable: true,
          impact: 'negligible',
        },
      }
    }

    // For create/update/where operations, ensure it's a string
    const transformation = isOptional
      ? `${variableName} !== null ? String(${variableName}) : null`
      : `String(${variableName})`

    return {
      code: transformation,
      imports: [],
      needsErrorHandling: false,
      performance: {
        complexity: 'simple',
        inlinable: true,
        impact: 'negligible',
      },
    }
  }
}

/**
 * Pre-configured SQLite transformation generator instance
 */
export const sqliteGenerator = new SQLiteTransformationGenerator()
