import { EngineValidationError, OutputTypeDescription } from '@prisma/engine-core'

export type IncludeAndSelectError = {
  kind: 'IncludeAndSelect'
  selectionPath: string[]
}

export type IncludeOnScalarError = {
  kind: 'IncludeOnScalar'
  selectionPath: string[]
  outputType?: OutputTypeDescription
}
export type ValidationError = IncludeAndSelectError | IncludeOnScalarError | EngineValidationError
