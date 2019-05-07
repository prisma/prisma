import indent from 'indent-string'
import chalk from 'chalk'
import { printJsonWithErrors, MissingItem } from './utils/printJsonErrors'
import { /*dmmf, */ DMMFClass } from './dmmf'
import { DMMF } from './dmmf-types'
import {
  getSuggestion,
  getGraphQLType,
  stringifyGraphQLType,
  stringifyInputType,
  unionBy,
  inputTypeToJson,
  getInputTypeName,
} from './utils/common'
import { InvalidArgError, ArgError, FieldError, InvalidFieldNameError } from './types'
import stringifyObject from './utils/stringifyObject'
import { deepExtend } from './utils/deep-extend'
import { omit } from './utils/omit'

const tab = 2

export class Document {
  constructor(public readonly type: 'query' | 'mutation', public readonly children: Field[]) {
    this.type = type
    this.children = children
  }
  toString() {
    return `${this.type} {
${indent(this.children.map(String).join('\n'), tab)}
}`
  }
  validate(select: any, isTopLevelQuery: boolean = false) {
    const invalidChildren = this.children.filter(child => child.hasInvalidChild || child.hasInvalidArg)
    if (invalidChildren.length === 0) {
      return
    }

    const fieldErrors: FieldError[] = []
    const argErrors: ArgError[] = []

    for (const child of invalidChildren) {
      const errors = child.collectErrors(null)
      fieldErrors.push(...errors.fieldErrors.map(e => ({ ...e, path: isTopLevelQuery ? e.path : e.path.slice(1) })))
      argErrors.push(...errors.argErrors.map(e => ({ ...e, path: isTopLevelQuery ? e.path : e.path.slice(1) })))
    }

    const topLevelQueryName = this.children[0].name
    const queryName = isTopLevelQuery ? this.type : topLevelQueryName
    const keyPaths = fieldErrors.map(e => e.path.join('.'))
    const valuePaths = []
    const missingItems: MissingItem[] = []
    // an arg error can either be an invalid key or invalid value
    for (const argError of argErrors) {
      if (argError.error.type === 'invalidName') {
        keyPaths.push(argError.path.join('.'))
      } else if (argError.error.type !== 'missingArg') {
        valuePaths.push(argError.path.join('.'))
      } else if (argError.error.type === 'missingArg') {
        missingItems.push({
          path: argError.path.join('.'),
          type: inputTypeToJson(argError.error.missingType, true),
        })
      }
    }

    const errorStr = `\n\n${chalk.red(`Invalid ${chalk.bold(`\`prisma.${queryName}\``)} invocation:`)}

${printJsonWithErrors(isTopLevelQuery ? { [topLevelQueryName]: select } : select, keyPaths, valuePaths, missingItems)}

${argErrors.map(this.printArgError).join('\n')}
${fieldErrors.map(this.printFieldError).join('\n')}\n`

    throw new InvalidClientInputError(errorStr)
  }
  protected printFieldError = ({ error }: FieldError) => {
    let str = `Unknown field ${chalk.redBright(`\`${error.providedName}\``)} on model ${chalk.bold.white(
      error.modelName,
    )}.`

    if (error.didYouMean) {
      str += ` Did you mean ${chalk.greenBright(`\`${error.didYouMean}\``)}?`
    }

    return str
  }
  protected printArgError = ({ error, path }: ArgError) => {
    if (error.type === 'invalidName') {
      let str = `Unknown arg ${chalk.redBright(`\`${error.providedName}\``)} in ${chalk.bold(
        path.join('.'),
      )}. for type ${chalk.bold(getInputTypeName(error.originalType))}`
      if (error.didYouMean) {
        str += ` Did you mean \`${chalk.greenBright(error.didYouMean)}\`?`
      } else {
        str += ` The available args are:\n` + stringifyInputType(error.originalType)
      }
      return str
    }

    if (error.type === 'invalidType') {
      let valueStr = stringifyObject(error.providedValue, { indent: '  ' })
      const multilineValue = valueStr.split('\n').length > 1
      if (multilineValue) {
        valueStr = `\n${valueStr}\n`
      }
      return `Argument ${chalk.bold(error.argName)}: Got invalid value ${chalk.redBright(valueStr)}${
        multilineValue ? '' : ' '
      }on query ${chalk.bold(`prisma.${this.children[0].name}`)}. Provided ${chalk.redBright(
        getGraphQLType(error.providedValue),
      )}, expected ${chalk.greenBright(
        stringifyGraphQLType(error.requiredType.type.toString(), error.requiredType.isList),
      )}.`
    }

    if (error.type === 'missingArg') {
      return `Argument ${chalk.greenBright(error.missingName)} for ${chalk.bold(
        `prisma.${path.join('.')}`,
      )} is missing. You can see in ${chalk.greenBright('green')} what you need to add.`
    }
  }
}

class InvalidClientInputError extends Error {}

export interface FieldArgs {
  name: string
  args?: Args
  children?: Field[]
  error?: InvalidFieldNameError
}

export class Field {
  public readonly name: string
  public readonly args?: Args
  public readonly children?: Field[]
  public readonly error?: InvalidFieldNameError
  public readonly hasInvalidChild: boolean
  public readonly hasInvalidArg: boolean
  constructor({ name, args, children, error }: FieldArgs) {
    this.name = name
    this.args = args
    this.children = children
    this.error = error
    this.hasInvalidChild = children ? children.some(child => Boolean(child.error)) : false
    this.hasInvalidArg = args ? args.hasInvalidArg : false
  }
  toString() {
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
  collectErrors(ownPrefix = 'select'): { fieldErrors: FieldError[]; argErrors: ArgError[] } {
    const fieldErrors: FieldError[] = []
    const argErrors: ArgError[] = []

    if (this.error) {
      const ownPath = []
      if (ownPrefix) {
        ownPath.push(ownPrefix)
      }
      fieldErrors.push({
        path: [...ownPath, this.name],
        error: this.error,
      })
    }

    // get all errors from fields
    if (this.children) {
      for (const child of this.children) {
        const errors = child.collectErrors()
        fieldErrors.push(...errors.fieldErrors.map(e => ({ ...e, path: [this.name, ...e.path] })))
        argErrors.push(...errors.argErrors.map(e => ({ ...e, path: [this.name, ...e.path] })))
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
  public readonly args?: Arg[]
  public readonly hasInvalidArg: boolean
  constructor(args: Arg[] = []) {
    this.args = args
    this.hasInvalidArg = args ? args.some(arg => Boolean(arg.hasError)) : false
  }
  toString() {
    if (this.args.length === 0) {
      return ''
    }
    return `${this.args.map(String).join('\n')}`
  }
  collectErrors(): ArgError[] {
    if (!this.hasInvalidArg) {
      return []
    }

    return this.args.flatMap(arg => arg.collectErrors())
  }
}

export class Arg {
  public readonly key: string
  public readonly value: ArgValue
  public readonly error?: InvalidArgError
  public readonly hasError: boolean

  constructor(key: string, value: ArgValue, error?: InvalidArgError) {
    this.key = key
    this.value = value
    this.error = error
    this.hasError =
      Boolean(error) ||
      (value instanceof Args ? value.hasInvalidArg : false) ||
      (Array.isArray(value) && value.some(v => (v instanceof Args ? v.hasInvalidArg : false)))
  }
  _toString(value: ArgValue, key: string): string {
    if (value instanceof Args) {
      return `${key}: {
${indent(value.toString(), 2)}
}`
    }

    if (Array.isArray(value)) {
      const isScalar = !(value as Array<any>).some(v => typeof v === 'object')
      return `${key}: [${isScalar ? '' : '\n'}${indent(
        (value as Array<any>)
          .map(nestedValue => {
            if (nestedValue instanceof Args) {
              return `{\n${indent(nestedValue.toString(), tab)}\n}`
            }
            return JSON.stringify(nestedValue)
          })
          .join(`,${isScalar ? ' ' : '\n'}`),
        isScalar ? 0 : tab,
      )}${isScalar ? '' : '\n'}]`
    }

    return `${key}: ${JSON.stringify(value, null, 2)}`
  }
  toString() {
    return this._toString(this.value, this.key)
  }
  collectErrors(): ArgError[] {
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
        ...(this.value as Array<any>).flatMap((val, index) => {
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

export type ArgValue = string | boolean | number | Args | string[] | boolean[] | number[] | Args[]

export interface DocumentInput {
  dmmf: DMMFClass
  rootTypeName: 'query' | 'mutation'
  rootField: string
  select: any
}

export function makeDocument({ dmmf, rootTypeName, rootField, select }: DocumentInput) {
  const rootType = rootTypeName === 'query' ? dmmf.queryType : dmmf.mutationType
  // Create a fake toplevel field for easier implementation
  const _rootField: DMMF.SchemaField = {
    args: [],
    isList: false,
    isRequired: true,
    name: rootTypeName,
    type: rootType,
    isScalar: false,
  }
  return new Document(rootTypeName, selectionToFields(dmmf, { [rootField]: select }, _rootField, [rootTypeName]))
}

export function selectionToFields(dmmf: DMMFClass, selection: any, field: DMMF.SchemaField, path: string[]): Field[] {
  const outputType = field.type as DMMF.MergedOutputType
  return Object.entries(selection).reduce(
    (acc, [name, value]: any) => {
      if (value === false) {
        return acc
      }
      const field = outputType.fields.find(f => f.name === name)
      if (!field) {
        // if the field name is incorrect, we ignore the args and child fields altogether
        acc.push(
          new Field({
            name,
            children: [],
            error: {
              modelName: outputType.name,
              providedName: name,
              didYouMean: getSuggestion(name, outputType.fields.map(f => f.name)),
            },
          }),
        )

        return acc
      }

      const argsWithoutSelect = typeof value === 'object' ? omit(value, 'select') : undefined
      const args = argsWithoutSelect ? objectToArgs(argsWithoutSelect, field) : undefined
      const isRelation = !field.isScalar
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
    if (f.isScalar) {
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

function getInvalidTypeArg(key: string, value: any, arg: DMMF.SchemaArg): Arg {
  return new Arg(key, value, {
    type: 'invalidType',
    providedValue: value,
    argName: key,
    requiredType: {
      isList: arg.isList,
      isRequired: arg.isRequired,
      isScalar: arg.isScalar,
      type: arg.type,
    },
  })
}

function hasCorrectScalarType(value: any, arg: DMMF.SchemaArg): boolean {
  const expectedType = stringifyGraphQLType(arg.type as string, arg.isList)
  const graphQLType = getGraphQLType(value)
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
  return graphQLType === expectedType
}

function valueToArg(key: string, value: any, arg: DMMF.SchemaArg): Arg | null {
  if (typeof value === 'undefined') {
    // the arg is undefined and not required - we're fine
    if (!arg.isRequired) {
      return null
    }

    // the provided value is 'undefined' but shouldn't be
    // console.log({ key, value })
    return new Arg(key, value, {
      type: 'missingArg',
      missingName: key,
      isScalar: arg.isScalar,
      isList: arg.isList,
      missingType: arg.type,
    })
  }

  // the provided value should be a valid scalar, but isn't
  if (!arg.isList && arg.isScalar) {
    if (hasCorrectScalarType(value, arg)) {
      return new Arg(key, value)
    }
    return getInvalidTypeArg(key, value, arg)
  }

  // the provided arg should be a list, but isn't
  // that's fine for us as we can just turn this into a list with a single item
  // and GraphQL even allows this. We're going the conservative route though
  // and actually generate the [] around the value
  if (arg.isList && !Array.isArray(value)) {
    value = [value]
  }

  if (arg.isList && arg.isScalar) {
    // if no value is incorrect
    if (hasCorrectScalarType(value, arg)) {
      return new Arg(key, value)
    } else {
      return getInvalidTypeArg(key, value, arg)
    }
  }

  if (!arg.isList && !arg.isScalar) {
    if (typeof value !== 'object' || !value) {
      return getInvalidTypeArg(key, value, arg)
    }
    return new Arg(key, objectToArgs(value, arg.type as DMMF.InputType))
  }

  if (arg.isList && !arg.isScalar) {
    return new Arg(
      key,
      value.map(v => {
        if (typeof v !== 'object' || !value) {
          return getInvalidTypeArg(key, v, arg)
        }
        return objectToArgs(v, arg.type as DMMF.InputType)
      }),
    )
  }

  // TODO: Decide for better default case
  throw new Error('Oops. This must not happen')
}

function objectToArgs(obj: any, inputType: DMMF.InputType): Args {
  const { args } = inputType
  const requiredArgs: [string, any][] = args.filter(arg => arg.isRequired).map(arg => [arg.name, undefined])
  const entries = unionBy(Object.entries(obj), requiredArgs, a => a[0])
  return new Args(
    entries.reduce(
      (acc, [argName, value]: any) => {
        const schemaArg = args.find(schemaArg => schemaArg.name === argName)
        if (!schemaArg) {
          acc.push(
            new Arg(argName, value, {
              type: 'invalidName',
              providedName: argName,
              didYouMean: getSuggestion(argName, [...args.map(arg => arg.name), 'select']),
              originalType: inputType,
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
    ),
  )
}
