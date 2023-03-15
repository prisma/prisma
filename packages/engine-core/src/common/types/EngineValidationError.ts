export type EngineValidationError =
  | EmptySelectionError
  | UnknownSelectionFieldError
  | SelectionSetOnScalarError
  | UnknownArgumentError
  | MissingRequiredArgumentError
  | InvalidArgumentTypeError

export type EmptySelectionError = {
  kind: 'EmptySelection'
  selectionPath: string[]
  outputType: OutputTypeDescription
}

export type UnknownSelectionFieldError = {
  kind: 'UnknownSelectionField'
  selectionPath: string[]
  outputType: OutputTypeDescription
}

export type SelectionSetOnScalarError = {
  kind: 'SelectionSetOnScalar'
  selectionPath: string[]
}

export type UnknownArgumentError = {
  kind: 'UnknownArgument'
  selectionPath: string[]
  argumentPath: string[]
  arguments: ArgumentDescription[]
}

export type MissingRequiredArgumentError = {
  kind: 'MissingRequiredArgument'
  argumentName: string
  argumentType: InputTypeDescription
}

export type InvalidArgumentTypeError = {
  kind: 'InvalidArgumentType'
  selectionPath: string[]
  argumentPath: string[]
  providedType: string
  expectedTypes: string[]
}

export type OutputTypeDescription = {
  name: string
  fields: OutputTypeDescriptionField[]
}

export type OutputTypeDescriptionField = {
  name: string
  typeName: string
  isRelation: boolean
}

export type InputTypeDescription = {
  name: string
  fields: InputTypeDescriptionField[]
}

export type InputTypeDescriptionField = {
  name: string
  typeNames: string[]
  required: boolean
}

export type ArgumentDescription = {
  name: string
  typeNames: string[]
}

export type InputTypeConstraints = {
  minNumberOfFields?: number
  maxNumberOfFields?: number
  requiredFields?: string[]
}
