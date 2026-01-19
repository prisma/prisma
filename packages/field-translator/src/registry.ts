/**
 * Transformation generator registry implementation
 *
 * Manages dialect-specific field transformation generators and provides
 * a unified interface for generating transformation code.
 */

import type {
  DatabaseDialect,
  FieldTransformationGenerator,
  FieldTransformContext,
  GeneratedTransformation,
  TransformationGeneratorRegistry,
} from './types.js'
import { UnsupportedDialectError } from './types.js'

export class DefaultTransformationGeneratorRegistry implements TransformationGeneratorRegistry {
  private generators = new Map<DatabaseDialect, FieldTransformationGenerator>()

  register(generator: FieldTransformationGenerator): void {
    this.generators.set(generator.dialect, generator)
  }

  getGenerator(dialect: DatabaseDialect): FieldTransformationGenerator | undefined {
    return this.generators.get(dialect)
  }

  getSupportedDialects(): DatabaseDialect[] {
    return Array.from(this.generators.keys())
  }

  generateTransformation(dialect: DatabaseDialect, context: FieldTransformContext): GeneratedTransformation {
    const generator = this.getGenerator(dialect)
    if (!generator) {
      throw new UnsupportedDialectError(dialect)
    }

    if (!generator.supportsField(context.field)) {
      throw new Error(`Field type '${context.field.fieldType}' is not supported by ${dialect} generator`)
    }

    return generator.generateTransformation(context)
  }
}

/**
 * Global registry instance
 */
export const transformationRegistry = new DefaultTransformationGeneratorRegistry()
