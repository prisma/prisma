import { DMMF } from './dmmf-types'

export interface ArgError {
  path: string[]
  error: InvalidArgError
}

export interface FieldError {
  path: string[]
  error: InvalidFieldNameError
}

export interface InvalidFieldNameError {
  modelName: string
  didYouMean?: string
  providedName: string
}

export type JavaScriptPrimitiveType = 'number' | 'string' | 'boolean'

export type InvalidArgError = InvalidArgNameError | MissingArgError | InvalidArgTypeError

/**
 * This error occurs if the user provides an arg name that doens't exist
 */
export type InvalidArgNameError = {
  type: 'invalidName'
  providedName: string
  didYouMean?: string // if the possible names are too different and therefore just arbitrary, we don't suggest anything
  originalType: string | DMMF.InputType
}

/**
 * Opposite of InvalidArgNameError - if the user *doesn't* provide an arg that should be provided
 * This error both happens with an implicit and explicit `undefined`
 */
export type MissingArgError = {
  type: 'missingArg'
  missingName: string
  missingType: string | DMMF.InputType // note that this could be an object or scalar type. in the object case, we print the whole object type
  isScalar: boolean // useful for error printing
  isList: boolean
}

/**
 * If the scalar type of an arg is not matching what is required
 */
export type InvalidArgTypeError = {
  type: 'invalidType'
  argName: string
  requiredType: {
    type: string | DMMF.InputType
    isRequired: boolean
    isScalar: boolean
    isList: boolean
  }
  providedValue: any
}
