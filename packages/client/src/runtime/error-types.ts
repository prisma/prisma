import type { DMMF } from './dmmf-types'

export interface ArgError {
  path: string[]
  id?: string
  error: InvalidArgError
}

export interface FieldError {
  path: string[]
  error: InvalidFieldError
}

export type InvalidFieldError =
  | InvalidFieldNameError
  | InvalidFieldTypeError
  | EmptySelectError
  | NoTrueSelectError
  | IncludeAndSelectError
  | EmptyIncludeError

export interface InvalidFieldTypeError {
  type: 'invalidFieldType'
  modelName: string
  fieldName: string
  providedValue: any
}

export interface InvalidFieldNameError {
  type: 'invalidFieldName'
  modelName: string
  didYouMean?: string | null
  providedName: string
  isInclude?: boolean
  isIncludeScalar?: boolean
  outputType: DMMF.OutputType
}

export interface EmptySelectError {
  type: 'emptySelect'
  field: DMMF.SchemaField
}

export interface EmptyIncludeError {
  type: 'emptyInclude'
  field: DMMF.SchemaField
}

export interface NoTrueSelectError {
  type: 'noTrueSelect'
  field: DMMF.SchemaField
}

export interface IncludeAndSelectError {
  type: 'includeAndSelect'
  field: DMMF.SchemaField
}

export type JavaScriptPrimitiveType = 'number' | 'string' | 'boolean'

export type InvalidArgError =
  | InvalidArgNameError
  | MissingArgError
  | InvalidArgTypeError
  | AtLeastOneError
  | AtMostOneError
  | InvalidNullArgError
  | InvalidDateArgError

/**
 * This error occurs if the user provides an arg name that doesn't exist
 */
export interface InvalidArgNameError {
  type: 'invalidName'
  providedName: string
  providedValue: any
  didYouMeanArg?: string // if the possible names are too different and therefore just arbitrary, we don't suggest anything
  didYouMeanField?: string // if it's very similar to a field, they probably just forgot the select statement
  originalType: DMMF.ArgType
  possibilities?: DMMF.SchemaArgInputType[]
  outputType?: DMMF.OutputType
}

/**
 * Opposite of InvalidArgNameError - if the user *doesn't* provide an arg that should be provided
 * This error both happens with an implicit and explicit `undefined`
 */
export interface MissingArgError {
  type: 'missingArg'
  missingName: string
  missingArg: DMMF.SchemaArg // context of the schema arg to show a nice error
  atLeastOne: boolean
  atMostOne: boolean
}

/**
 * If a user incorrectly provided null where she shouldn't have
 */
export interface InvalidNullArgError {
  type: 'invalidNullArg'
  name: string
  invalidType: DMMF.SchemaArgInputType[] // note that this could be an object or scalar type. in the object case, we print the whole object type
  atLeastOne: boolean
  atMostOne: boolean
}

/**
 * User provided invalid date value
 */
export interface InvalidDateArgError {
  type: 'invalidDateArg'
  argName: string
}

export interface AtMostOneError {
  type: 'atMostOne'
  key: string
  inputType: DMMF.InputType
  providedKeys: string[]
}

export interface AtLeastOneError {
  type: 'atLeastOne'
  key: string
  inputType: DMMF.InputType
  atLeastFields?: string[]
}

/**
 * If the scalar type of an arg is not matching what is required
 */
export interface InvalidArgTypeError {
  type: 'invalidType'
  argName: string
  requiredType: {
    bestFittingType: DMMF.SchemaArgInputType
    inputType: DMMF.SchemaArgInputType[]
  }
  providedValue: any
}
