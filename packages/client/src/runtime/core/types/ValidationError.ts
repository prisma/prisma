import { EngineValidationError, OutputTypeDescription } from '@prisma/engine-core'

export type IncludeAndSelectError = {
  kind: 'includeAndSelect'
  selectionPath: string[]
}

export type IncludeOnScalarError = {
  kind: 'includeOnScalar'
  selectionPath: string[]
  outputType?: OutputTypeDescription
}
export type ValidationError = IncludeAndSelectError | IncludeOnScalarError | EngineValidationError
