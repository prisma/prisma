/**
 * MySQL Field Transformation Code Generator
 * 
 * Generates build-time transformation code for MySQL-specific type mappings
 * including TINYINT boolean support, JSON handling, and DECIMAL precision.
 * 
 * All transformations produce inline code with zero runtime overhead.
 */

import type { FieldAST } from '@refract/schema-parser'
import type {
  FieldTransformationGenerator,
  FieldTransformContext,
  GeneratedTransformation,
  TransformationOperation
} from '../types.js'
import { UnsupportedFieldTypeError } from '../types.js'

export class MySQLTransformationGenerator implements FieldTransformationGenerator {
  readonly dialect = 'mysql' as const

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
        return 'VARCHAR(255)'
      case 'Int':
        return 'INT'
      case 'BigInt':
        return 'BIGINT'
      case 'Float':
        return 'FLOAT'
      case 'Decimal':
        return 'DECIMAL(10,2)'
      case 'Boolean':
        return 'TINYINT(1)' // MySQL uses TINYINT for booleans
      case 'DateTime':
        return 'DATETIME'
      case 'Json':
        return 'JSON' // MySQL 5.7+ native JSON support
      default:
        return 'VARCHAR(255)'
    }
  }

  private generateBooleanTransformation(
    operation: TransformationOperation,
    variableName: string
  ): GeneratedTransformation {
    if (operation === 'select') {
      // MySQL returns TINYINT as 0/1, convert to boolean
      return {
        code: `${variableName} === 1`,
        imports: [],
        needsErrorHandling: false,
        performance: {
          complexity: 'simple',
          inlinable: true,
          impact: 'negligible'
        }
      }
    }

    // For create/update/where operations, convert to 0/1
    return {
      code: `${variableName} ? 1 : 0`,
      imports: [],
      needsErrorHandling: false,
      performance: {
        complexity: 'simple',
        inlinable: true,
        impact: 'negligible'
      }
    }
  }

  private generateDateTimeTransformation(
    operation: TransformationOperation,
    variableName: string,
    field: FieldAST
  ): GeneratedTransformation {
    const isOptional = field.isOptional

    if (operation === 'select') {
      // MySQL driver typically returns Date objects
      return {
        code: variableName,
        imports: [],
        needsErrorHandling: false,
        performance: {
          complexity: 'simple',
          inlinable: true,
          impact: 'negligible'
        }
      }
    }

    // For create/update/where operations, ensure proper Date format
    const transformations = {
      create: isOptional 
        ? `${variableName} ? (${variableName} instanceof Date ? ${variableName} : new Date(${variableName})) : null`
        : `${variableName} instanceof Date ? ${variableName} : new Date(${variableName})`,
      
      update: isOptional
        ? `${variableName} ? (${variableName} instanceof Date ? ${variableName} : new Date(${variableName})) : null`
        : `${variableName} instanceof Date ? ${variableName} : new Date(${variableName})`,
      
      where: isOptional
        ? `${variableName} ? (${variableName} instanceof Date ? ${variableName} : new Date(${variableName})) : null`
        : `${variableName} instanceof Date ? ${variableName} : new Date(${variableName})`
    }

    return {
      code: transformations[operation]!,
      imports: [],
      needsErrorHandling: true, // Date parsing can fail
      performance: {
        complexity: 'moderate',
        inlinable: true,
        impact: 'low'
      }
    }
  }

  private generateJsonTransformation(
    operation: TransformationOperation,
    variableName: string
  ): GeneratedTransformation {
    if (operation === 'select') {
      // MySQL JSON is automatically parsed by the driver in most cases
      return {
        code: `typeof ${variableName} === 'string' ? JSON.parse(${variableName}) : ${variableName}`,
        imports: [],
        needsErrorHandling: true, // JSON.parse can fail
        performance: {
          complexity: 'moderate',
          inlinable: true,
          impact: 'low'
        }
      }
    }

    // For create/update/where operations, MySQL accepts objects or strings
    return {
      code: `typeof ${variableName} === 'string' ? ${variableName} : JSON.stringify(${variableName})`,
      imports: [],
      needsErrorHandling: false,
      performance: {
        complexity: 'moderate',
        inlinable: true,
        impact: 'low'
      }
    }
  }

  private generateIntegerTransformation(
    operation: TransformationOperation,
    variableName: string,
    field: FieldAST
  ): GeneratedTransformation {
    const isBigInt = field.fieldType === 'BigInt'
    const isOptional = field.isOptional

    if (operation === 'select') {
      // MySQL driver handles type conversion
      if (isBigInt) {
        return {
          code: isOptional ? `${variableName} !== null ? BigInt(${variableName}) : null` : `BigInt(${variableName})`,
          imports: [],
          needsErrorHandling: false,
          performance: {
            complexity: 'simple',
            inlinable: true,
            impact: 'negligible'
          }
        }
      } else {
        return {
          code: variableName,
          imports: [],
          needsErrorHandling: false,
          performance: {
            complexity: 'simple',
            inlinable: true,
            impact: 'negligible'
          }
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
          impact: 'negligible'
        }
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
          impact: 'negligible'
        }
      }
    }
  }

  private generateNumericTransformation(
    operation: TransformationOperation,
    variableName: string,
    field: FieldAST
  ): GeneratedTransformation {
    const isOptional = field.isOptional
    
    if (operation === 'select') {
      // MySQL driver handles numeric conversion
      return {
        code: variableName,
        imports: [],
        needsErrorHandling: false,
        performance: {
          complexity: 'simple',
          inlinable: true,
          impact: 'negligible'
        }
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
        impact: 'negligible'
      }
    }
  }

  private generateStringTransformation(
    operation: TransformationOperation,
    variableName: string,
    field: FieldAST
  ): GeneratedTransformation {
    const isOptional = field.isOptional

    if (operation === 'select') {
      // MySQL returns strings as-is
      return {
        code: variableName,
        imports: [],
        needsErrorHandling: false,
        performance: {
          complexity: 'simple',
          inlinable: true,
          impact: 'negligible'
        }
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
        impact: 'negligible'
      }
    }
  }
}

/**
 * Pre-configured MySQL transformation generator instance
 */
export const mysqlGenerator = new MySQLTransformationGenerator()