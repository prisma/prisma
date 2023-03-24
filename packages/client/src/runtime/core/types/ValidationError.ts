import { EngineValidationError, OutputTypeDescription } from '@prisma/engine-core'

/**
 * There are couple of more validation errors we add on top of the engine ones.
 * They are specific to `include` and `select` handling and can not be performed
 * on the engine level: `select` and `include` do not exist on protocol level (it is always
 * single `selection` field with a list of fields) so there is no way for the engine to impose
 * any rules on them.
 */

/**
 * `include` and `select` are used at the same time
 */
export type IncludeAndSelectError = {
  kind: 'IncludeAndSelect'
  selectionPath: string[]
}

/**
 * Scalar value is mentioned in `include` block (only relations are supposed to be used here)
 */
export type IncludeOnScalarError = {
  kind: 'IncludeOnScalar'
  selectionPath: string[]
  outputType?: OutputTypeDescription
}
export type ValidationError = IncludeAndSelectError | IncludeOnScalarError | EngineValidationError
