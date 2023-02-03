export type EngineValidationError =
  | EmptySelectionError
  | UnknownSelectionFieldError
  | SelectionSetOnScalarError
  | UnknownArgumentError

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
  selectionPath: string[]
  argumentPath: string[]
  argumentType: InputTypeDescription
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
  field: InputTypeDescriptionField[]
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
