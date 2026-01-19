/**
 * PostgreSQL Field Transformation Code Generator
 *
 * Generates build-time transformation code for PostgreSQL-specific type mappings
 * including native boolean support, JSONB handling, UUID support, and array types.
 *
 * All transformations produce inline code with zero runtime overhead.
 */

import type { FieldAST } from '@ork-orm/schema-parser'

import type {
  FieldTransformationGenerator,
  FieldTransformContext,
  GeneratedTransformation,
  TransformationOperation,
} from '../types.js'
import { UnsupportedFieldTypeError } from '../types.js'

export class PostgreSQLTransformationGenerator implements FieldTransformationGenerator {
  readonly dialect = 'postgresql' as const

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
    // Check for autoincrement on integer types
    const hasAutoIncrement = field.attributes?.some(
      (attr: any) => attr.name === 'default' && attr.args?.[0]?.value === 'autoincrement()',
    )

    switch (field.fieldType) {
      case 'String':
        return 'text'
      case 'Int':
        // PostgreSQL uses serial for autoincrementing integers
        return hasAutoIncrement ? 'serial' : 'integer'
      case 'BigInt':
        // PostgreSQL uses bigserial for autoincrementing bigints
        return hasAutoIncrement ? 'bigserial' : 'bigint'
      case 'Float':
        return 'doublePrecision'
      case 'Decimal':
        return 'decimal'
      case 'Boolean':
        return 'boolean' // PostgreSQL has native boolean support
      case 'DateTime':
        return 'timestamptz'
      case 'Json':
        return 'jsonb' // PostgreSQL prefers JSONB over JSON
      default:
        return 'text'
    }
  }

  private generateBooleanTransformation(
    operation: TransformationOperation,
    variableName: string,
  ): GeneratedTransformation {
    // PostgreSQL handles booleans natively - no transformation needed
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

  private generateDateTimeTransformation(
    operation: TransformationOperation,
    variableName: string,
    field: FieldAST,
  ): GeneratedTransformation {
    const isOptional = field.isOptional

    if (operation === 'select') {
      // PostgreSQL returns dates as Date objects through the driver
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

    // For create/update/where operations
    // Cast to valid Date constructor argument types to satisfy TypeScript
    const transformations = {
      create: isOptional
        ? `${variableName} ? new Date(${variableName} as string | number | Date) : null`
        : `new Date(${variableName} as string | number | Date)`,
      update: isOptional
        ? `${variableName} ? new Date(${variableName} as string | number | Date) : null`
        : `new Date(${variableName} as string | number | Date)`,
      where: isOptional
        ? `${variableName} ? new Date(${variableName} as string | number | Date) : null`
        : `new Date(${variableName} as string | number | Date)`,
    }

    return {
      code: transformations[operation]!,
      imports: [],
      needsErrorHandling: true, // Date parsing can fail
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
    if (operation === 'select') {
      // PostgreSQL JSONB is automatically parsed by the driver
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

    // For create/update/where operations, PostgreSQL accepts objects directly
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

  private generateIntegerTransformation(
    operation: TransformationOperation,
    variableName: string,
    field: FieldAST,
  ): GeneratedTransformation {
    const isBigInt = field.fieldType === 'BigInt'
    const isOptional = field.isOptional

    if (operation === 'select') {
      // PostgreSQL driver handles type conversion
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
      // PostgreSQL driver handles numeric conversion
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
      // PostgreSQL returns strings as-is
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
 * Pre-configured PostgreSQL transformation generator instance
 */
export const postgresqlGenerator = new PostgreSQLTransformationGenerator()
