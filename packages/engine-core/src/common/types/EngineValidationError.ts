export type EngineValidationError =
  | EmptySelectionError
  | UnknownSelectionFieldError
  | SelectionSetOnScalarError
  | UnknownArgumentError
  | UnknownInputFieldError
  | RequiredArgumentMissingError
  | InvalidArgumentTypeError
  | InvalidArgumentValueError
  | UnionError

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

export type UnknownInputFieldError = {
  kind: 'UnknownInputField'
  selectionPath: string[]
  argumentPath: string[]
  inputType: InputTypeObjectDescription
}

export type RequiredArgumentMissingError = {
  kind: 'RequiredArgumentMissing'
  argumentPath: string[]
  inputTypes: InputTypeDescription[]
}

export type InvalidArgumentTypeError = {
  kind: 'InvalidArgumentType'
  selectionPath: string[]
  argumentPath: string[]
  argument: ArgumentDescription
  inferredType: string
}

export type InvalidArgumentValueError = {
  kind: 'InvalidArgumentValue'
  selectionPath: string[]
  argumentPath: string[]
  argument: ArgumentDescription
  underlyingError: string
}

export type UnionError = {
  kind: 'Union'
  errors: EngineValidationError[]
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

export type InputTypeDescription =
  | InputTypeObjectDescription
  | InputTypeListDescription
  | InputTypeScalarDescription
  | InputTypeEnumDescription

export type InputTypeObjectDescription = {
  kind: 'object'
  name: string
  fields: InputTypeDescriptionField[]
}

export type InputTypeListDescription = {
  kind: 'list'
  elementType: InputTypeDescription
}

export type InputTypeScalarDescription = {
  kind: 'scalar'
  name: string
}

export type InputTypeEnumDescription = {
  kind: 'enum'
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
