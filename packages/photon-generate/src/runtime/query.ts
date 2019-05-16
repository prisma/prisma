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
  wrapWithList,
} from './utils/common'
import { InvalidArgError, ArgError, FieldError, InvalidFieldError } from './types'
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
  validate(select: any, isTopLevelQuery: boolean = false, originalMethod?: string) {
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
      } else if (argError.error.type !== 'missingArg') {
        valuePaths.push(path)
      } else if (argError.error.type === 'missingArg') {
        missingItems.push({
          path,
          type: inputTypeToJson(argError.error.missingType, true),
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
      let str = `Invalid value ${chalk.redBright(`${stringifyObject(error.providedValue)}`)} of type ${chalk.redBright(
        getGraphQLType(error.providedValue, undefined),
      )} for field ${chalk.bold(`${error.fieldName}`)} on model ${chalk.bold.white(
        error.modelName,
      )}. Expected either ${chalk.greenBright('true')} or ${chalk.greenBright('false')}.`

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
      } else {
        if ((error.originalType as DMMF.InputType).args.length === 0) {
          str += ` The field ${chalk.bold((error.originalType as DMMF.InputType).name)} has no arguments.`
        } else {
          str += ` The available args are:\n` + stringifyInputType(error.originalType)
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
      if (error.requiredType.isEnum) {
        return `Argument ${chalk.bold(error.argName)}: Provided value ${chalk.redBright(valueStr)}${
          multilineValue ? '' : ' '
        }of type ${chalk.redBright(getGraphQLType(error.providedValue))} on ${chalk.bold(
          `photon.${this.children[0].name}`,
        )} is not a ${chalk.greenBright(
          wrapWithList(stringifyGraphQLType(error.requiredType.type), error.requiredType.isList),
        )}.
→ Possible values: ${(error.requiredType.type as DMMF.Enum).values
          .map(v => chalk.greenBright(`${stringifyGraphQLType(error.requiredType.type)}.${v}`))
          .join(', ')}`
      }

      let typeStr = '.'
      if (!error.requiredType.isScalar) {
        typeStr = ':\n' + stringifyInputType(error.requiredType.type)
      }
      return `Argument ${chalk.bold(error.argName)}: Got invalid value ${chalk.redBright(valueStr)}${
        multilineValue ? '' : ' '
      }on ${chalk.bold(`photon.${this.children[0].name}`)}. Provided ${chalk.redBright(
        getGraphQLType(error.providedValue),
      )}, expected ${chalk.greenBright(
        wrapWithList(stringifyGraphQLType(error.requiredType.type), error.requiredType.isList),
      )}${typeStr}`
    }

    if (error.type === 'missingArg') {
      return `Argument ${chalk.greenBright(error.missingName)} for ${chalk.bold(
        `photon.${path.join('.')}`,
      )} is missing. You can see in ${chalk.greenBright('green')} what you need to add.`
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
  collectErrors(prefix = 'select'): { fieldErrors: FieldError[]; argErrors: ArgError[] } {
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

/**
 * Custom stringify which turns undefined into null - needed by GraphQL
 * @param obj to stringify
 * @param _
 * @param tab
 */
function stringify(obj, _?: any, tab?: string | number, isEnum?: boolean) {
  if (obj === undefined) {
    return null
  }

  if (isEnum && typeof obj === 'string') {
    return obj
  }

  if (isEnum && Array.isArray(obj)) {
    return `[${obj.join(', ')}]`
  }

  return JSON.stringify(obj, _, tab)
}

export class Arg {
  public readonly key: string
  public readonly value: ArgValue
  public readonly error?: InvalidArgError
  public readonly hasError: boolean
  public readonly isEnum: boolean

  constructor(key: string, value: ArgValue, isEnum: boolean, error?: InvalidArgError) {
    this.key = key
    this.value = value
    this.error = error
    this.isEnum = isEnum
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
            return stringify(nestedValue, null, 2, this.isEnum)
          })
          .join(`,${isScalar ? ' ' : '\n'}`),
        isScalar ? 0 : tab,
      )}${isScalar ? '' : '\n'}]`
    }

    return `${key}: ${stringify(value, null, 2, this.isEnum)}`
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

export type ArgValue = string | boolean | number | undefined | Args | string[] | boolean[] | number[] | Args[]

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
    kind: 'relation',
  }
  return new Document(rootTypeName, selectionToFields(dmmf, { [rootField]: select }, _rootField, [rootTypeName]))
}

export function selectionToFields(dmmf: DMMFClass, selection: any, field: DMMF.SchemaField, path: string[]): Field[] {
  const outputType = field.type as DMMF.MergedOutputType
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

function getInvalidTypeArg(key: string, value: any, arg: DMMF.SchemaArg): Arg {
  return new Arg(key, value, arg.isEnum, {
    type: 'invalidType',
    providedValue: value,
    argName: key,
    requiredType: {
      isList: arg.isList,
      isEnum: arg.isEnum,
      isRequired: arg.isRequired,
      isScalar: arg.isScalar,
      type: arg.type,
    },
  })
}

function hasCorrectScalarType(value: any, arg: DMMF.SchemaArg): boolean {
  const expectedType = wrapWithList(stringifyGraphQLType(arg.type as string), arg.isList)
  const graphQLType = getGraphQLType(value, arg.type)
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
    return new Arg(key, value, arg.isEnum, {
      type: 'missingArg',
      missingName: key,
      isScalar: arg.isScalar,
      isEnum: arg.isEnum,
      isList: arg.isList,
      missingType: arg.type,
      isRequired: true,
    })
  }

  // the provided value should be a valid scalar, but isn't
  if (!arg.isList && arg.isScalar) {
    if (hasCorrectScalarType(value, arg)) {
      return new Arg(key, value, arg.isEnum)
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
      return new Arg(key, value, arg.isEnum)
    } else {
      return getInvalidTypeArg(key, value, arg)
    }
  }

  if (!arg.isList && !arg.isScalar) {
    if (typeof value !== 'object' || !value) {
      return getInvalidTypeArg(key, value, arg)
    }
    return new Arg(key, objectToArgs(value, arg.type as DMMF.InputType), arg.isEnum)
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
      arg.isEnum,
    )
  }

  // TODO: Decide for better default case
  throw new Error('Oops. This must not happen')
}

function objectToArgs(obj: any, inputType: DMMF.InputType, outputType?: DMMF.MergedOutputType): Args {
  const { args } = inputType
  const requiredArgs: [string, any][] = args.filter(arg => arg.isRequired).map(arg => [arg.name, undefined])
  const entries = unionBy(Object.entries(obj), requiredArgs, a => a[0])
  const argsList = entries.reduce(
    (acc, [argName, value]: any) => {
      const schemaArg = args.find(schemaArg => schemaArg.name === argName)
      if (!schemaArg) {
        const didYouMeanField =
          typeof value === 'boolean' && outputType && outputType.fields.some(f => f.name === argName) ? argName : null
        acc.push(
          new Arg(argName, value, false, {
            type: 'invalidName',
            providedName: argName,
            providedValue: value,
            didYouMeanField,
            didYouMeanArg:
              (!didYouMeanField && getSuggestion(argName, [...args.map(arg => arg.name), 'select'])) || undefined,
            originalType: inputType,
            outputType,
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
  if (argsList.find(arg => arg.error && arg.error.type === 'missingArg')) {
    const optionalMissingArgs = inputType.args.filter(arg => !entries.some(([entry]) => entry === arg.name))
    argsList.push(
      ...optionalMissingArgs.map(
        arg =>
          new Arg(arg.name, undefined, arg.isEnum, {
            type: 'missingArg',
            isEnum: arg.isEnum,
            isList: arg.isList,
            isScalar: arg.isScalar,
            missingName: arg.name,
            missingType: arg.type,
            isRequired: false, // must be false here
          }),
      ),
    )
  }
  return new Args(argsList)
}
