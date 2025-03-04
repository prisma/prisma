import type { EngineValidationError, OutputTypeDescription } from '../engines'

/**
 * There are couple of more validation errors we add on top of the engine ones.
 * They are specific to `include` and `select` handling and can not be performed
 * on the engine level: `select` and `include` do not exist on protocol level (it is always
 * single `selection` field with a list of fields) so there is no way for the engine to impose
 * any rules on them.
 */

/**
 * Pair of mutually exclusive fields are found on selection (for example select + include or select + omit)
 */
export type MutuallyExclusiveFieldsError = {
  kind: 'MutuallyExclusiveFields'
  firstField: string
  secondField: string
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

/**
 * Invalid value is passed to selection field
 */
export type InvalidSelectionValueError = {
  kind: 'InvalidSelectionValue'
  selectionPath: string[]

  underlyingError: string
}

export type ValidationError =
  | MutuallyExclusiveFieldsError
  | InvalidSelectionValueError
  | IncludeOnScalarError
  | EngineValidationError
