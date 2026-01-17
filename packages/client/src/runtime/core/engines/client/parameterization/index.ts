/**
 * Schema-aware parameterization module.
 *
 * This module provides schema-aware query parameterization using the
 * ParamGraph data structure generated from DMMF at client generation time.
 */

// Re-export types and functions from classify
export type { ValueClass } from './classify'
export { classifyValue, isPlainObject, isTaggedValue } from './classify'

// Re-export types and functions from paramGraphView
export type { ParamGraphView } from './paramGraphView'
export { createParamGraphView } from './paramGraphView'

// Re-export types and functions from traverse
export type { ParameterizeBatchResult, ParameterizeResult } from './traverse'
export { parameterizeBatchWithSchema, parameterizeQueryWithSchema } from './traverse'
