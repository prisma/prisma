export type EngineValidationError =
  | EmptySelectionError
  | UnknownSelectionFieldError
  | SelectionSetOnScalarError
  | UnknownArgumentError
  | UnknownInputFieldError
  | RequiredArgumentMissingError
  | InvalidArgumentTypeError
  | InvalidArgumentValueError
  | SomeFieldsMissingError
  | TooManyFieldsGivenError
  | UnionError

/**
 * Selection for relation/composite field is empty. Can happen
 * when either `select` has `{}` as a value or all fields in the
 * selection are `false`
 */
export type EmptySelectionError = {
  kind: 'EmptySelection'

  selectionPath: string[]

  /**
   * Description of an output type at `selectionPath`. Can be
   * used for displaying suggestions
   */
  outputType: OutputTypeDescription
}

/**
 * Unknown field is mentioned in selection
 */
export type UnknownSelectionFieldError = {
  kind: 'UnknownSelectionField'
  selectionPath: string[]
  /**
   * Description of an output type at `selectionPath`. Can be
   * used for displaying suggestions
   */
  outputType: OutputTypeDescription
}

/**
 * Attempt to use nested selection on scalar field. For example:
 *
 * ```
 * select: {
 *   email: {
 *     something: true
 *   }
 * }
 * ```
 */
export type SelectionSetOnScalarError = {
  kind: 'SelectionSetOnScalar'
  selectionPath: string[]
}

/**
 * Unknown argument is used for a query. For example:
 *
 * ```ts
 * prisma.user.findMany({ filter: { active: true }})
 * ```
 *
 * Difference with `UnknownInputFieldError`: arguments are always top
 * level, where input fields are nested.
 */
export type UnknownArgumentError = {
  kind: 'UnknownArgument'
  selectionPath: string[]
  argumentPath: string[]
  arguments: ArgumentDescription[]
}

/**
 * Unknown nested input field is used within a query
 *
 * ```ts
 * prisma.user.findMany({ where: { notAField: true }})
 * ```
 *
 * Difference with `UnknownArgumentError`: arguments are always top
 * level, where input fields are nested.
 */
export type UnknownInputFieldError = {
  kind: 'UnknownInputField'
  selectionPath: string[]
  argumentPath: string[]
  inputType: InputTypeObjectDescription
}

/**
 * Required argument or input field is missing in the query.
 * For example, `where` argument for `findUnique`:
 *
 * ```
 * prisma.user.findUnique({ })
 * ```
 *
 * Can also be nested.
 */
export type RequiredArgumentMissingError = {
  kind: 'RequiredArgumentMissing'
  argumentPath: string[]
  selectionPath: string[]

  /**
   * Possible types of the missing argument/field
   */
  inputTypes: InputTypeDescription[]
}

/**
 * Value of invalid type is passed to the input field or
 * argument. Example:
 *
 * ```
 * prisma.user.findMany({ take: 'everything' })
 * ```
 *
 *
 */
export type InvalidArgumentTypeError = {
  kind: 'InvalidArgumentType'
  selectionPath: string[]
  argumentPath: string[]

  /**
   * Describes the expected argument, in particular, it's
   * expected types
   */
  argument: ArgumentDescription

  /**
   * Actual type that was passed by the user, as inferred by the engine
   */
  inferredType: string
}

/**
 * Passed value is technically of the correct type, but can not be accepted
 * due to other constraints. Example include:
 *
 * - Non-IS08601 string passed to date field
 * - Overflowing integers
 */
export type InvalidArgumentValueError = {
  kind: 'InvalidArgumentValue'
  selectionPath: string[]
  argumentPath: string[]
  argument: ArgumentDescription

  /**
   * Additional message from the engine, describing the reason value
   * can not be accepted.
   */
  underlyingError: string
}

/**
 * Less then minimum required number of fields is used within input object.
 * Examples of this include `where` argument of `findUnique`: we need at least
 * 1 sub-field specified, but we don't care which one it is specifically.
 */
export type SomeFieldsMissingError = {
  kind: 'SomeFieldsMissing'
  selectionPath: string[]
  argumentPath: string[]
  inputType: InputTypeObjectDescription
  constraints: InputTypeConstraints
}

/**
 * More than maximum expected amount of fields is specified within input object.
 * Example of that is again, `where` argument of `findUnique` (without `extendedWhereUnique` feature):
 * we expect only 1 field to be specified there, any more will result in an error
 */
export type TooManyFieldsGivenError = {
  kind: 'TooManyFieldsGiven'
  selectionPath: string[]
  argumentPath: string[]
  inputType: InputTypeObjectDescription
  constraints: InputTypeConstraints
}

/**
 * Special error type, used for reporting errors within input union types.
 * If field can have several possible types and input validation fails on each of them,
 * this error will be used for reporting individual failures for each of the types.
 */
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
  name: string
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
  minFieldCount?: number
  maxFieldCount?: number
  requiredFields: string[] | null
}
