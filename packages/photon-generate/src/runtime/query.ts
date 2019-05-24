import chalk from 'chalk'
import indent from 'indent-string'
import { /*dmmf, */ DMMFClass } from './dmmf'
import { DMMF } from './dmmf-types'
import {
  ArgError,
  AtLeastOneError,
  AtMostOneError,
  FieldError,
  InvalidArgError,
  InvalidFieldError,
} from './error-types'
import {
  getGraphQLType,
  getInputTypeName,
  getSuggestion,
  inputTypeToJson,
  stringifyGraphQLType,
  stringifyInputType,
  unionBy,
  wrapWithList,
} from './utils/common'
import { deepExtend } from './utils/deep-extend'
import { omit } from './utils/omit'
import { MissingItem, printJsonWithErrors } from './utils/printJsonErrors'
import stringifyObject from './utils/stringifyObject'
import { visit } from './visit'

const tab = 2

export class Document {
  constructor(public readonly type: 'query' | 'mutation', public readonly children: Field[]) {
    this.type = type
    this.children = children
  }
  public toString() {
    return `${this.type} {
${indent(this.children.map(String).join('\n'), tab)}
}`
  }
  public validate(select: any, isTopLevelQuery: boolean = false, originalMethod?: string) {
    const invalidChildren = this.children.filter(child => child.hasInvalidChild || child.hasInvalidArg)
    if (invalidChildren.length === 0) {
      return
    }

    const fieldErrors: FieldError[] = []
    const argErrors: ArgError[] = []

    for (const child of invalidChildren) {
      const errors = child.collectErrors()
      fieldErrors.push(...errors.fieldErrors.map(e => ({ ...e, path: isTopLevelQuery ? e.path : e.path.slice(1) })))
      argErrors.push(...errors.argErrors.map(e => ({ ...e, path: isTopLevelQuery ? e.path : e.path.slice(1) })))
    }

    const topLevelQueryName = this.children[0].name
    const queryName = isTopLevelQuery ? this.type : topLevelQueryName
    const keyPaths: string[] = []
    const valuePaths: string[] = []
    const missingItems: MissingItem[] = []
    for (const fieldError of fieldErrors) {
      const path = fieldError.path.join('.')
      if (fieldError.error.type === 'invalidFieldName') {
        keyPaths.push(path)
      } else {
        valuePaths.push(path)
      }
    }
    // an arg error can either be an invalid key or invalid value
    for (const argError of argErrors) {
      const path = argError.path.join('.')
      if (argError.error.type === 'invalidName') {
        keyPaths.push(path)
      } else if (argError.error.type !== 'missingArg' && argError.error.type !== 'atLeastOne') {
        valuePaths.push(path)
      } else if (argError.error.type === 'missingArg') {
        const type =
          argError.error.missingType.length === 1
            ? argError.error.missingType[0]
            : argError.error.missingType.map(getInputTypeName).join(' | ')
        missingItems.push({
          path,
          type: inputTypeToJson(type, true),
          isRequired: argError.error.isRequired,
        })
      }
    }

    const errorStr = `\n\n${chalk.red(
      `Invalid ${chalk.bold(`\`photon.${originalMethod || queryName}()\``)} invocation:`,
    )}

${printJsonWithErrors(isTopLevelQuery ? { [topLevelQueryName]: select } : select, keyPaths, valuePaths, missingItems)}

${argErrors
  .filter(e => e.error.type !== 'missingArg' || e.error.isRequired)
  .map(this.printArgError)
  .join('\n')}
${fieldErrors.map(this.printFieldError).join('\n')}\n`

    throw new InvalidClientInputError(errorStr)
  }
  protected printFieldError = ({ error }: FieldError) => {
    if (error.type === 'invalidFieldName') {
      let str = `Unknown field ${chalk.redBright(`\`${error.providedName}\``)} on model ${chalk.bold.white(
        error.modelName,
      )}.`

      if (error.didYouMean) {
        str += ` Did you mean ${chalk.greenBright(`\`${error.didYouMean}\``)}?`
      }

      return str
    }
    if (error.type === 'invalidFieldType') {
      const str = `Invalid value ${chalk.redBright(
        `${stringifyObject(error.providedValue)}`,
      )} of type ${chalk.redBright(getGraphQLType(error.providedValue, undefined))} for field ${chalk.bold(
        `${error.fieldName}`,
      )} on model ${chalk.bold.white(error.modelName)}. Expected either ${chalk.greenBright(
        'true',
      )} or ${chalk.greenBright('false')}.`

      return str
    }
  }
  protected printArgError = ({ error, path }: ArgError) => {
    if (error.type === 'invalidName') {
      let str = `Unknown arg ${chalk.redBright(`\`${error.providedName}\``)} in ${chalk.bold(
        path.join('.'),
      )}. for type ${chalk.bold(error.outputType ? error.outputType.name : getInputTypeName(error.originalType))}.`
      if (error.didYouMeanField) {
        str += `\n→ Did you forget to wrap it with \`${chalk.greenBright('select')}\`? ${chalk.dim(
          'e.g. ' + chalk.greenBright(`{ select: { ${error.providedName}: ${error.providedValue} } }`),
        )}`
      } else if (error.didYouMeanArg) {
        str += ` Did you mean \`${chalk.greenBright(error.didYouMeanArg)}\`?`
        str += ` ${chalk.dim('Available args:\n')}` + stringifyInputType(error.originalType, true)
      } else {
        if ((error.originalType as DMMF.InputType).args.length === 0) {
          str += ` The field ${chalk.bold((error.originalType as DMMF.InputType).name)} has no arguments.`
        } else {
          str += ` Available args:\n` + stringifyInputType(error.originalType, true)
        }
      }
      return str
    }

    if (error.type === 'invalidType') {
      let valueStr = stringifyObject(error.providedValue, { indent: '  ' })
      const multilineValue = valueStr.split('\n').length > 1
      if (multilineValue) {
        valueStr = `\n${valueStr}\n`
      }
      // TODO: we don't yet support enums in a union with a non enum. This is mostly due to not implemented error handling
      // at this code part.
      if (error.requiredType.isEnum) {
        return `Argument ${chalk.bold(error.argName)}: Provided value ${chalk.redBright(valueStr)}${
          multilineValue ? '' : ' '
        }of type ${chalk.redBright(getGraphQLType(error.providedValue))} on ${chalk.bold(
          `photon.${this.children[0].name}`,
        )} is not a ${chalk.greenBright(
          wrapWithList(stringifyGraphQLType(error.requiredType.bestFittingType), error.requiredType.isList),
        )}.
→ Possible values: ${(error.requiredType.bestFittingType as DMMF.Enum).values
          .map(v => chalk.greenBright(`${stringifyGraphQLType(error.requiredType.bestFittingType)}.${v}`))
          .join(', ')}`
      }

      let typeStr = '.'
      if (isInputArgType(error.requiredType.bestFittingType)) {
        typeStr = ':\n' + stringifyInputType(error.requiredType.bestFittingType)
      }
      let expected = `${error.requiredType.types
        .map(t => chalk.greenBright(wrapWithList(stringifyGraphQLType(t), error.requiredType.isList)))
        .join(' or ')}${typeStr}`
      const inputType: null | DMMF.InputType =
        ((error.requiredType.types.length === 2 &&
          error.requiredType.types.find(t => isInputArgType(t))) as DMMF.InputType) || null
      if (inputType) {
        expected += `\n` + stringifyInputType(inputType, true)
      }
      return `Argument ${chalk.bold(error.argName)}: Got invalid value ${chalk.redBright(valueStr)}${
        multilineValue ? '' : ' '
      }on ${chalk.bold(`photon.${this.children[0].name}`)}. Provided ${chalk.redBright(
        getGraphQLType(error.providedValue),
      )}, expected ${expected}`
    }

    if (error.type === 'missingArg') {
      return `Argument ${chalk.greenBright(error.missingName)} for ${chalk.bold(
        `photon.${path.join('.')}`,
      )} is missing. You can see in ${chalk.greenBright('green')} what you need to add.`
    }

    if (error.type === 'atLeastOne') {
      return `Argument ${chalk.bold(path.join('.'))} of type ${chalk.bold(
        error.inputType.name,
      )} needs ${chalk.greenBright('at least one')} argument. Available args are listed in ${chalk.dim.green('green')}.`
    }

    if (error.type === 'atMostOne') {
      return `Argument ${chalk.bold(path.join('.'))} of type ${chalk.bold(
        error.inputType.name,
      )} needs ${chalk.greenBright('exactly one')} argument, but you provided ${error.providedKeys
        .map(key => chalk.redBright(key))
        .join(' and ')}. Please choose one. ${chalk.dim('Available args:')} \n${stringifyInputType(
        error.inputType,
        true,
      )}`
    }
  }
}

class InvalidClientInputError extends Error {}

export interface FieldArgs {
  name: string
  args?: Args
  children?: Field[]
  error?: InvalidFieldError
}

export class Field {
  public readonly name: string
  public readonly args?: Args
  public readonly children?: Field[]
  public readonly error?: InvalidFieldError
  public readonly hasInvalidChild: boolean
  public readonly hasInvalidArg: boolean
  constructor({ name, args, children, error }: FieldArgs) {
    this.name = name
    this.args = args
    this.children = children
    this.error = error
    this.hasInvalidChild = children
      ? children.some(child => Boolean(child.error || child.hasInvalidArg || child.hasInvalidChild))
      : false
    this.hasInvalidArg = args ? args.hasInvalidArg : false
  }
  public toString() {
    let str = this.name

    // TODO: Decide if we should do this
    if (this.error) {
      return str + ' # INVALID_FIELD'
    }

    if (this.args && this.args.args && this.args.args.length > 0) {
      if (this.args.args.length === 1) {
        str += `(${this.args.toString()})`
      } else {
        str += `(\n${indent(this.args.toString(), tab)}\n)`
      }
    }

    if (this.children) {
      str += ` {
${indent(this.children.map(String).join('\n'), tab)}
}`
    }

    return str
  }
  public collectErrors(prefix = 'select'): { fieldErrors: FieldError[]; argErrors: ArgError[] } {
    const fieldErrors: FieldError[] = []
    const argErrors: ArgError[] = []

    if (this.error) {
      fieldErrors.push({
        path: [this.name],
        error: this.error,
      })
    }

    // get all errors from fields
    if (this.children) {
      for (const child of this.children) {
        const errors = child.collectErrors()
        // Field -> Field always goes through a 'select'
        fieldErrors.push(...errors.fieldErrors.map(e => ({ ...e, path: [this.name, 'select', ...e.path] })))
        argErrors.push(...errors.argErrors.map(e => ({ ...e, path: [this.name, 'select', ...e.path] })))
      }
    }

    // get all errors from args
    if (this.args) {
      argErrors.push(...this.args.collectErrors().map(e => ({ ...e, path: [this.name, ...e.path] })))
    }

    return {
      fieldErrors,
      argErrors,
    }
  }
}

export class Args {
  public readonly args: Arg[]
  public readonly hasInvalidArg: boolean
  constructor(args: Arg[] = []) {
    this.args = args
    this.hasInvalidArg = args ? args.some(arg => Boolean(arg.hasError)) : false
  }
  public toString() {
    if (this.args.length === 0) {
      return ''
    }
    return `${this.args.map(String).join('\n')}`
  }
  public collectErrors(): ArgError[] {
    if (!this.hasInvalidArg) {
      return []
    }

    return this.args.flatMap(arg => arg.collectErrors())
  }
}

/**
 * Custom stringify which turns undefined into null - needed by GraphQL
 * @param obj to stringify
 * @param _
 * @param tab
 */
function stringify(obj, _?: any, tabbing?: string | number, isEnum?: boolean) {
  if (obj === undefined) {
    return null
  }

  if (isEnum && typeof obj === 'string') {
    return obj
  }

  if (isEnum && Array.isArray(obj)) {
    return `[${obj.join(', ')}]`
  }

  return JSON.stringify(obj, _, tabbing)
}

interface ArgOptions {
  key: string
  value: ArgValue
  argType?: DMMF.ArgType // just needed to transform the ast
  isEnum?: boolean
  error?: InvalidArgError
  schemaArg?: DMMF.SchemaArg
}

export class Arg {
  public readonly key: string
  public readonly value: ArgValue
  public readonly error?: InvalidArgError
  public readonly hasError: boolean
  public readonly isEnum: boolean
  public readonly schemaArg?: DMMF.SchemaArg
  public readonly argType?: DMMF.ArgType

  constructor({ key, value, argType, isEnum = false, error, schemaArg }: ArgOptions) {
    this.key = key
    this.value = value
    this.argType = argType
    this.isEnum = isEnum
    this.error = error
    this.schemaArg = schemaArg
    this.hasError =
      Boolean(error) ||
      (value instanceof Args ? value.hasInvalidArg : false) ||
      (Array.isArray(value) && value.some(v => (v instanceof Args ? v.hasInvalidArg : false)))
  }
  public _toString(value: ArgValue, key: string): string {
    if (value instanceof Args) {
      return `${key}: {
${indent(value.toString(), 2)}
}`
    }

    if (Array.isArray(value)) {
      const isScalar = !(value as any[]).some(v => typeof v === 'object')
      return `${key}: [${isScalar ? '' : '\n'}${indent(
        (value as any[])
          .map(nestedValue => {
            if (nestedValue instanceof Args) {
              return `{\n${indent(nestedValue.toString(), tab)}\n}`
            }
            return stringify(nestedValue, null, 2, this.isEnum)
          })
          .join(`,${isScalar ? ' ' : '\n'}`),
        isScalar ? 0 : tab,
      )}${isScalar ? '' : '\n'}]`
    }

    return `${key}: ${stringify(value, null, 2, this.isEnum)}`
  }
  public toString() {
    return this._toString(this.value, this.key)
  }
  public collectErrors(): ArgError[] {
    if (!this.hasError) {
      return []
    }

    const errors: ArgError[] = []

    // add the own arg
    if (this.error) {
      errors.push({
        error: this.error,
        path: [this.key],
      })
    }

    if (Array.isArray(this.value)) {
      errors.push(
        ...(this.value as any[]).flatMap((val, index) => {
          if (!val.collectErrors) {
            return []
          }

          return val.collectErrors().map(e => {
            return { ...e, path: [this.key, index, ...e.path] }
          })
        }),
      )
    }

    // collect errors of children if there are any
    if (this.value instanceof Args) {
      errors.push(...this.value.collectErrors().map(e => ({ ...e, path: [this.key, ...e.path] })))
    }

    return errors
  }
}

export type ArgValue = string | boolean | number | undefined | Args | string[] | boolean[] | number[] | Args[]

export interface DocumentInput {
  dmmf: DMMFClass
  rootTypeName: 'query' | 'mutation'
  rootField: string
  select: any
}

export function makeDocument({ dmmf, rootTypeName, rootField, select }: DocumentInput) {
  // console.log(stringifyInputType(input))
  const rootType = rootTypeName === 'query' ? dmmf.queryType : dmmf.mutationType
  // Create a fake toplevel field for easier implementation
  const fakeRootField: DMMF.SchemaField = {
    args: [],
    isList: false,
    isRequired: true,
    name: rootTypeName,
    type: rootType,
    kind: 'relation',
  }
  return new Document(rootTypeName, selectionToFields(dmmf, { [rootField]: select }, fakeRootField, [rootTypeName]))
}

export function transformDocument(document: Document): Document {
  function transformWhereArgs(args: Args) {
    return new Args(
      args.args.flatMap(ar => {
        if (isArgsArray(ar.value)) {
          // long variable name to prevent shadowing
          const value = ar.value.map(argsInstance => {
            return transformWhereArgs(argsInstance)
          })
          return new Arg({ ...ar, value })
        } else if (ar.value instanceof Args) {
          if (ar.schemaArg && !ar.schemaArg.isRelationFilter) {
            return ar.value.args.map(
              a =>
                new Arg({
                  key: getFilterArgName(ar.key, a.key),
                  value: a.value,
                }),
            )
          }
        }
        return [ar]
      }),
    )
  }
  function transformOrderArg(arg: Arg) {
    if (arg.value instanceof Args) {
      const orderArg = arg.value.args[0]
      return new Arg({
        ...arg,
        isEnum: true,
        value: `${orderArg.key}_${orderArg.value!.toString().toUpperCase()}`,
      })
    }

    return arg
  }
  return visit(document, {
    Arg: {
      enter(arg) {
        const { argType, schemaArg } = arg
        if (!argType) {
          return undefined
        }

        if (isInputArgType(argType) && argType.isOrderType) {
          return transformOrderArg(arg)
        }

        if (isInputArgType(argType) && argType.isWhereType && schemaArg) {
          let value
          if (isArgsArray(arg.value)) {
            value = arg.value.map(val => transformWhereArgs(val))
          } else if (arg.value instanceof Args) {
            value = transformWhereArgs(arg.value)
          }
          return new Arg({ ...arg, value })
        }
        return undefined
      },
    },
  })
}

function isArgsArray(input: any): input is Args[] {
  if (Array.isArray(input)) {
    return input.every(arg => arg instanceof Args)
  }

  return false
}

function getFilterArgName(arg: string, filter: string) {
  if (filter === 'equals') {
    return arg
  }

  return `${arg}_${filter}`
}

export function selectionToFields(
  dmmf: DMMFClass,
  selection: any,
  schemaField: DMMF.SchemaField,
  path: string[],
): Field[] {
  const outputType = schemaField.type as DMMF.MergedOutputType
  return Object.entries(selection).reduce(
    (acc, [name, value]: any) => {
      const field = outputType.fields.find(f => f.name === name)
      if (!field) {
        // if the field name is incorrect, we ignore the args and child fields altogether
        acc.push(
          new Field({
            name,
            children: [],
            // @ts-ignore
            error: {
              type: 'invalidFieldName',
              modelName: outputType.name,
              providedName: name,
              didYouMean: getSuggestion(name, outputType.fields.map(f => f.name)),
            },
          }),
        )

        return acc
      }
      if (typeof value !== 'boolean' && field.kind === 'scalar') {
        acc.push(
          new Field({
            name,
            children: [],
            error: {
              type: 'invalidFieldType',
              modelName: outputType.name,
              fieldName: name,
              providedValue: value,
            },
          }),
        )

        return acc
      }
      if (value === false) {
        return acc
      }

      const argsWithoutSelect = typeof value === 'object' ? omit(value, 'select') : undefined
      const args = argsWithoutSelect
        ? objectToArgs(
            argsWithoutSelect,
            field,
            [],
            typeof field === 'string' ? undefined : (field.type as DMMF.MergedOutputType),
          )
        : undefined
      const isRelation = field.kind === 'relation'
      const defaultSelection = isRelation ? getDefaultSelection(field.type as DMMF.MergedOutputType) : null
      const select = deepExtend(defaultSelection, value.select)
      const children =
        select !== false && isRelation ? selectionToFields(dmmf, select, field, [...path, name]) : undefined
      acc.push(new Field({ name, args, children }))

      return acc
    },
    [] as Field[],
  )
}

function getDefaultSelection(outputType: DMMF.MergedOutputType) {
  return outputType.fields.reduce((acc, f) => {
    if (f.kind === 'scalar') {
      acc[f.name] = true
    } else {
      // otherwise field is a relation. Only continue if it's an embedded type
      // as normal types don't end up in the default selection
      if ((f.type as DMMF.MergedOutputType).isEmbedded) {
        acc[f.name] = { select: getDefaultSelection(f.type as DMMF.MergedOutputType) }
      }
    }

    return acc
  }, {})
}

function getInvalidTypeArg(key: string, value: any, arg: DMMF.SchemaArg, bestFittingType: DMMF.ArgType): Arg {
  return new Arg({
    key,
    value,
    isEnum: arg.isEnum,
    argType: bestFittingType,
    error: {
      type: 'invalidType',
      providedValue: value,
      argName: key,
      requiredType: {
        isList: arg.isList,
        isEnum: arg.isEnum,
        isRequired: arg.isRequired,
        isScalar: arg.isScalar,
        types: arg.type,
        bestFittingType,
      },
    },
  })
}

// TODO: Add type check for union in here
function hasCorrectScalarType(value: any, arg: DMMF.SchemaArg, type: string | DMMF.Enum): boolean {
  const expectedType = wrapWithList(stringifyGraphQLType(type), arg.isList)
  const graphQLType = getGraphQLType(value, type)
  // DateTime is a subset of string
  if (graphQLType === 'DateTime' && expectedType === 'String') {
    return true
  }
  if (graphQLType === 'String' && expectedType === 'ID') {
    return true
  }
  // Int is a subset of Float
  if (graphQLType === 'Int' && expectedType === 'Float') {
    return true
  }
  // Int is a subset of Long
  if (graphQLType === 'Int' && expectedType === 'Long') {
    return true
  }

  if (graphQLType === expectedType) {
    return true
  }
  return false
}

function valueToArg(key: string, value: any, arg: DMMF.SchemaArg): Arg | null {
  if (typeof value === 'undefined') {
    // the arg is undefined and not required - we're fine
    if (!arg.isRequired) {
      return null
    }

    // the provided value is 'undefined' but shouldn't be
    return new Arg({
      key,
      value,
      isEnum: arg.isEnum,
      error: {
        type: 'missingArg',
        missingName: key,
        isScalar: arg.isScalar,
        isEnum: arg.isEnum,
        isList: arg.isList,
        missingType: arg.type,
        isRequired: true,
        atLeastOne: false,
        atMostOne: false,
      },
    })
  }

  if (!arg.isList) {
    const args = arg.type.map(t => {
      if (isInputArgType(t)) {
        if (typeof value !== 'object') {
          return getInvalidTypeArg(key, value, arg, t)
        } else {
          let error: AtMostOneError | AtLeastOneError | undefined
          const keys = Object.keys(value)
          const numKeys = keys.length
          if (numKeys === 0 && t.atLeastOne) {
            error = {
              type: 'atLeastOne',
              key,
              inputType: t,
            }
          }
          if (numKeys > 1 && t.atMostOne) {
            error = {
              type: 'atMostOne',
              key,
              inputType: t,
              providedKeys: keys,
            }
          }
          return new Arg({
            key,
            value: objectToArgs(value, t, arg.type),
            isEnum: arg.isEnum,
            error,
            argType: t,
            schemaArg: arg,
          })
        }
      } else {
        return scalarToArg(key, value, arg, t)
      }
    })

    // is it just one possible type? Then no matter what just return that one
    if (args.length === 1) {
      return args[0]
    }

    // do we have more then one, but does it fit one of the args? Then let's just take that one arg
    const argWithoutError = args.find(a => !a.hasError)
    if (argWithoutError) {
      return argWithoutError
    }

    // if there are exactly 2 options, one scalar and one object, take the one that fits the provided type
    // (scalar or object)
    if (args.length === 2 && isInputArgType(arg.type[0]) !== isInputArgType(arg.type[1])) {
      if (value && typeof value === 'object') {
        if (isInputArgType(arg.type[0])) {
          return args[0]
        }
        return args[1]
      } else {
        if (isInputArgType(arg.type[0])) {
          return arg[1]
        }
        return args[0]
      }
    }

    // if we have 2 deeply nested objects and it fits way better with one of them,
    // show that one
    const argWithMinimumErrors = args.reduce<{ arg: null | Arg; numErrors: number }>(
      (acc, curr) => {
        const numErrors = curr.collectErrors().length
        if (numErrors < acc.numErrors) {
          return {
            arg: curr,
            numErrors,
          }
        }
        return acc
      },
      {
        arg: null,
        numErrors: Infinity,
      },
    )
    return argWithMinimumErrors.arg!
  }

  if (arg.type.length > 1) {
    throw new Error(`List types with union input types are not supported`)
  }

  // the provided arg should be a list, but isn't
  // that's fine for us as we can just turn this into a list with a single item
  // and GraphQL even allows this. We're going the conservative route though
  // and actually generate the [] around the value
  if (!Array.isArray(value)) {
    value = [value]
  }

  if (arg.isScalar) {
    // if no value is incorrect
    return scalarToArg(key, value, arg, arg.type[0] as string | DMMF.Enum)
  }

  if (!arg.isScalar) {
    return new Arg({
      key,
      value: value.map(v => {
        if (typeof v !== 'object' || !value) {
          return getInvalidTypeArg(key, v, arg, arg.type[0])
        }
        return objectToArgs(v, arg.type[0] as DMMF.InputType)
      }),
      isEnum: arg.isEnum,
      argType: arg.type[0],
      schemaArg: arg,
    })
  }

  // TODO: Decide for better default case
  throw new Error('Oops. This must not happen')
}

export function isInputArgType(argType: DMMF.ArgType): argType is DMMF.InputType {
  if (typeof argType === 'string') {
    return false
  }
  if (argType.hasOwnProperty('values')) {
    return false
  }

  return true
}

function scalarToArg(key: string, value: any, arg: DMMF.SchemaArg, type: string | DMMF.Enum): Arg {
  if (hasCorrectScalarType(value, arg, type)) {
    return new Arg({ key, value, isEnum: arg.isEnum, argType: type, schemaArg: arg })
  }
  return getInvalidTypeArg(key, value, arg, type)
}

function objectToArgs(
  obj: any,
  inputType: DMMF.InputType,
  possibilities?: DMMF.ArgType[],
  outputType?: DMMF.MergedOutputType,
): Args {
  const { args } = inputType
  const requiredArgs: Array<[string, any]> = args.filter(arg => arg.isRequired).map(arg => [arg.name, undefined])
  const entries = unionBy(Object.entries(obj), requiredArgs, a => a[0])
  const argsList = entries.reduce(
    (acc, [argName, value]: any) => {
      const schemaArg = args.find(a => a.name === argName)
      if (!schemaArg) {
        const didYouMeanField =
          typeof value === 'boolean' && outputType && outputType.fields.some(f => f.name === argName) ? argName : null
        acc.push(
          new Arg({
            key: argName,
            value,
            error: {
              type: 'invalidName',
              providedName: argName,
              providedValue: value,
              didYouMeanField,
              didYouMeanArg:
                (!didYouMeanField && getSuggestion(argName, [...args.map(a => a.name), 'select'])) || undefined,
              originalType: inputType,
              possibilities,
              outputType,
            },
          }),
        )
        return acc
      }

      const arg = valueToArg(argName, value, schemaArg)

      if (arg) {
        acc.push(arg)
      }

      return acc
    },
    [] as Arg[],
  )
  // Also show optional neighbour args, if there is any arg missing
  if (
    (entries.length === 0 && inputType.atLeastOne) ||
    argsList.find(arg => arg.error && arg.error.type === 'missingArg')
  ) {
    const optionalMissingArgs = inputType.args.filter(arg => !entries.some(([entry]) => entry === arg.name))
    argsList.push(
      ...optionalMissingArgs.map(
        arg =>
          new Arg({
            key: arg.name,
            value: undefined,
            isEnum: arg.isEnum,
            error: {
              type: 'missingArg',
              isEnum: arg.isEnum,
              isList: arg.isList,
              isScalar: arg.isScalar,
              missingName: arg.name,
              missingType: arg.type,
              isRequired: false, // must be false here
              atLeastOne: inputType.atLeastOne || false,
              atMostOne: inputType.atMostOne || false,
            },
          }),
      ),
    )
  }
  return new Args(argsList)
}
