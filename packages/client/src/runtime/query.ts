import chalk from 'chalk'
import Decimal from 'decimal.js'
import indent from 'indent-string'
import stripAnsi from 'strip-ansi'

import type { /*dmmf, */ DMMFHelper } from './dmmf'
import type { DMMF } from './dmmf-types'
import type {
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
  getOutputTypeName,
  getSuggestion,
  inputTypeToJson,
  isGroupByOutputName,
  stringifyGraphQLType,
  stringifyInputType,
  unionBy,
  wrapWithList,
} from './utils/common'
import { isDecimalJsLike, stringifyDecimalJsLike } from './utils/decimalJsLike'
import { deepExtend } from './utils/deep-extend'
import { deepGet } from './utils/deep-set'
import { filterObject } from './utils/filterObject'
import { flatMap } from './utils/flatMap'
import { isObject } from './utils/isObject'
import { omit } from './utils/omit'
import type { MissingItem, PrintJsonWithErrorsArgs } from './utils/printJsonErrors'
import { printJsonWithErrors } from './utils/printJsonErrors'
import { printStack } from './utils/printStack'
import stringifyObject from './utils/stringifyObject'

const tab = 2

export class Document {
  constructor(public readonly type: 'query' | 'mutation', public readonly children: Field[]) {
    this.type = type
    this.children = children
  }
  get [Symbol.toStringTag]() {
    return 'Document'
  }
  public toString() {
    return `${this.type} {
${indent(this.children.map(String).join('\n'), tab)}
}`
  }
  public validate(
    select?: any,
    isTopLevelQuery = false,
    originalMethod?: string,
    errorFormat?: 'pretty' | 'minimal' | 'colorless',
    validationCallsite?: any,
  ) {
    if (!select) {
      select = {}
    }
    const invalidChildren = this.children.filter((child) => child.hasInvalidChild || child.hasInvalidArg)
    if (invalidChildren.length === 0) {
      return
    }

    const fieldErrors: FieldError[] = []
    const argErrors: ArgError[] = []
    const prefix = select && select.select ? 'select' : select.include ? 'include' : undefined

    for (const child of invalidChildren) {
      const errors = child.collectErrors(prefix)
      fieldErrors.push(
        ...errors.fieldErrors.map((e) => ({
          ...e,
          path: isTopLevelQuery ? e.path : e.path.slice(1),
        })),
      )
      argErrors.push(
        ...errors.argErrors.map((e) => ({
          ...e,
          path: isTopLevelQuery ? e.path : e.path.slice(1),
        })),
      )
    }

    const topLevelQueryName = this.children[0].name
    const queryName = isTopLevelQuery ? this.type : topLevelQueryName
    const keyPaths: string[] = []
    const valuePaths: string[] = []
    const missingItems: MissingItem[] = []
    for (const fieldError of fieldErrors) {
      const path = this.normalizePath(fieldError.path, select).join('.')
      if (fieldError.error.type === 'invalidFieldName') {
        keyPaths.push(path)

        const fieldType = fieldError.error.outputType
        const { isInclude } = fieldError.error
        fieldType.fields
          .filter((field) => (isInclude ? field.outputType.location === 'outputObjectTypes' : true))
          .forEach((field) => {
            const splittedPath = path.split('.')
            missingItems.push({
              path: `${splittedPath.slice(0, splittedPath.length - 1).join('.')}.${field.name}`,
              type: 'true',
              isRequired: false,
            })
          })
      } else if (fieldError.error.type === 'includeAndSelect') {
        keyPaths.push('select')
        keyPaths.push('include')
      } else {
        valuePaths.push(path)
      }
      if (
        fieldError.error.type === 'emptySelect' ||
        fieldError.error.type === 'noTrueSelect' ||
        fieldError.error.type === 'emptyInclude'
      ) {
        const selectPathArray = this.normalizePath(fieldError.path, select)
        const selectPath = selectPathArray.slice(0, selectPathArray.length - 1).join('.')

        const fieldType = fieldError.error.field.outputType.type as DMMF.OutputType

        fieldType.fields
          ?.filter((field) =>
            fieldError.error.type === 'emptyInclude' ? field.outputType.location === 'outputObjectTypes' : true,
          )
          .forEach((field) => {
            missingItems.push({
              path: `${selectPath}.${field.name}`,
              type: 'true',
              isRequired: false,
            })
          })
      }
    }
    // an arg error can either be an invalid key or invalid value
    for (const argError of argErrors) {
      const path = this.normalizePath(argError.path, select).join('.')
      if (argError.error.type === 'invalidName') {
        keyPaths.push(path)
      } else if (argError.error.type !== 'missingArg' && argError.error.type !== 'atLeastOne') {
        valuePaths.push(path)
      } else if (argError.error.type === 'missingArg') {
        const type =
          argError.error.missingArg.inputTypes.length === 1
            ? argError.error.missingArg.inputTypes[0].type
            : argError.error.missingArg.inputTypes
                .map((t) => {
                  const inputTypeName = getInputTypeName(t.type)
                  if (inputTypeName === 'Null') {
                    return 'null'
                  }
                  if (t.isList) {
                    return inputTypeName + '[]'
                  }
                  return inputTypeName
                })
                .join(' | ')
        missingItems.push({
          path,
          type: inputTypeToJson(type, true, path.split('where.').length === 2),
          isRequired: argError.error.missingArg.isRequired,
        })
      }
    }

    const renderErrorStr = (callsite?: string) => {
      const hasRequiredMissingArgsErrors = argErrors.some(
        (e) => e.error.type === 'missingArg' && e.error.missingArg.isRequired,
      )
      const hasOptionalMissingArgsErrors = Boolean(
        argErrors.find((e) => e.error.type === 'missingArg' && !e.error.missingArg.isRequired),
      )
      const hasMissingArgsErrors = hasOptionalMissingArgsErrors || hasRequiredMissingArgsErrors

      let missingArgsLegend = ''
      if (hasRequiredMissingArgsErrors) {
        missingArgsLegend += `\n${chalk.dim('Note: Lines with ')}${chalk.reset.greenBright('+')} ${chalk.dim(
          'are required',
        )}`
      }

      if (hasOptionalMissingArgsErrors) {
        if (missingArgsLegend.length === 0) {
          missingArgsLegend = '\n'
        }
        if (hasRequiredMissingArgsErrors) {
          missingArgsLegend += chalk.dim(`, lines with ${chalk.green('?')} are optional`)
        } else {
          missingArgsLegend += chalk.dim(`Note: Lines with ${chalk.green('?')} are optional`)
        }
        missingArgsLegend += chalk.dim('.')
      }

      const relevantArgErrors = argErrors.filter((e) => e.error.type !== 'missingArg' || e.error.missingArg.isRequired)

      let errorMessages = relevantArgErrors
        .map((e) => this.printArgError(e, hasMissingArgsErrors, errorFormat === 'minimal')) // if no callsite is provided, just render the minimal error
        .join('\n')

      errorMessages += `
${fieldErrors.map((e) => this.printFieldError(e, missingItems, errorFormat === 'minimal')).join('\n')}`

      if (errorFormat === 'minimal') {
        return stripAnsi(errorMessages)
      }

      const {
        stack,
        indent: indentValue,
        afterLines,
      } = printStack({
        callsite,
        originalMethod: originalMethod || queryName,
        showColors: errorFormat && errorFormat === 'pretty',
        isValidationError: true,
      })

      let printJsonArgs: PrintJsonWithErrorsArgs = {
        ast: isTopLevelQuery ? { [topLevelQueryName]: select } : select,
        keyPaths,
        valuePaths,
        missingItems,
      }

      // as for aggregate we simplify the api to not include `select`
      // we need to map this here so the errors make sense
      if (originalMethod?.endsWith('aggregate')) {
        printJsonArgs = transformAggregatePrintJsonArgs(printJsonArgs)
      }

      const errorStr = `${stack}${indent(printJsonWithErrors(printJsonArgs), indentValue).slice(
        indentValue,
      )}${chalk.dim(afterLines)}

${errorMessages}${missingArgsLegend}\n`

      if (process.env.NO_COLOR || errorFormat === 'colorless') {
        return stripAnsi(errorStr)
      }
      return errorStr
    }
    // end renderErrorStr definition

    const error = new PrismaClientValidationError(renderErrorStr(validationCallsite))

    // @ts-ignore
    if (process.env.NODE_ENV !== 'production') {
      Object.defineProperty(error, 'render', {
        get: () => renderErrorStr,
        enumerable: false,
      })
    }
    throw error
  }
  protected printFieldError = ({ error }: FieldError, missingItems: MissingItem[], minimal: boolean) => {
    if (error.type === 'emptySelect') {
      const additional = minimal ? '' : ` Available options are listed in ${chalk.greenBright.dim('green')}.`
      return `The ${chalk.redBright('`select`')} statement for type ${chalk.bold(
        getOutputTypeName(error.field.outputType.type),
      )} must not be empty.${additional}`
    }
    if (error.type === 'emptyInclude') {
      if (missingItems.length === 0) {
        return `${chalk.bold(
          getOutputTypeName(error.field.outputType.type),
        )} does not have any relation and therefore can't have an ${chalk.redBright('`include`')} statement.`
      }
      const additional = minimal ? '' : ` Available options are listed in ${chalk.greenBright.dim('green')}.`
      return `The ${chalk.redBright('`include`')} statement for type ${chalk.bold(
        getOutputTypeName(error.field.outputType.type),
      )} must not be empty.${additional}`
    }
    if (error.type === 'noTrueSelect') {
      return `The ${chalk.redBright('`select`')} statement for type ${chalk.bold(
        getOutputTypeName(error.field.outputType.type),
      )} needs ${chalk.bold('at least one truthy value')}.`
    }
    if (error.type === 'includeAndSelect') {
      return `Please ${chalk.bold('either')} use ${chalk.greenBright('`include`')} or ${chalk.greenBright(
        '`select`',
      )}, but ${chalk.redBright('not both')} at the same time.`
    }
    if (error.type === 'invalidFieldName') {
      const statement = error.isInclude ? 'include' : 'select'
      const wording = error.isIncludeScalar ? 'Invalid scalar' : 'Unknown'
      const additional = minimal
        ? ''
        : error.isInclude && missingItems.length === 0
        ? `\nThis model has no relations, so you can't use ${chalk.redBright('include')} with it.`
        : ` Available options are listed in ${chalk.greenBright.dim('green')}.`
      let str = `${wording} field ${chalk.redBright(`\`${error.providedName}\``)} for ${chalk.bold(
        statement,
      )} statement on model ${chalk.bold.white(error.modelName)}.${additional}`

      if (error.didYouMean) {
        str += ` Did you mean ${chalk.greenBright(`\`${error.didYouMean}\``)}?`
      }

      if (error.isIncludeScalar) {
        str += `\nNote, that ${chalk.bold('include')} statements only accept relation fields.`
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

    return undefined
  }

  protected printArgError = ({ error, path, id }: ArgError, hasMissingItems: boolean, minimal: boolean) => {
    if (error.type === 'invalidName') {
      let str = `Unknown arg ${chalk.redBright(`\`${error.providedName}\``)} in ${chalk.bold(
        path.join('.'),
      )} for type ${chalk.bold(error.outputType ? error.outputType.name : getInputTypeName(error.originalType))}.`
      if (error.didYouMeanField) {
        str += `\n→ Did you forget to wrap it with \`${chalk.greenBright('select')}\`? ${chalk.dim(
          'e.g. ' + chalk.greenBright(`{ select: { ${error.providedName}: ${error.providedValue} } }`),
        )}`
      } else if (error.didYouMeanArg) {
        str += ` Did you mean \`${chalk.greenBright(error.didYouMeanArg)}\`?`
        if (!hasMissingItems && !minimal) {
          str += ` ${chalk.dim('Available args:')}\n` + stringifyInputType(error.originalType, true)
        }
      } else {
        if ((error.originalType as DMMF.InputType).fields.length === 0) {
          str += ` The field ${chalk.bold((error.originalType as DMMF.InputType).name)} has no arguments.`
        } else if (!hasMissingItems && !minimal) {
          str += ` Available args:\n\n` + stringifyInputType(error.originalType, true)
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
      if (error.requiredType.bestFittingType.location === 'enumTypes') {
        return `Argument ${chalk.bold(error.argName)}: Provided value ${chalk.redBright(valueStr)}${
          multilineValue ? '' : ' '
        }of type ${chalk.redBright(getGraphQLType(error.providedValue))} on ${chalk.bold(
          `prisma.${this.children[0].name}`,
        )} is not a ${chalk.greenBright(
          wrapWithList(
            stringifyGraphQLType(error.requiredType.bestFittingType.location),
            error.requiredType.bestFittingType.isList,
          ),
        )}.
→ Possible values: ${(error.requiredType.bestFittingType.type as DMMF.SchemaEnum).values
          .map((v) => chalk.greenBright(`${stringifyGraphQLType(error.requiredType.bestFittingType.type)}.${v}`))
          .join(', ')}`
      }

      let typeStr = '.'
      if (isInputArgType(error.requiredType.bestFittingType.type)) {
        typeStr = ':\n' + stringifyInputType(error.requiredType.bestFittingType.type)
      }
      let expected = `${error.requiredType.inputType
        .map((t) =>
          chalk.greenBright(wrapWithList(stringifyGraphQLType(t.type), error.requiredType.bestFittingType.isList)),
        )
        .join(' or ')}${typeStr}`
      const inputType: null | DMMF.SchemaArgInputType =
        (error.requiredType.inputType.length === 2 &&
          error.requiredType.inputType.find((t) => isInputArgType(t.type))) ||
        null
      if (inputType) {
        expected += `\n` + stringifyInputType(inputType.type, true)
      }
      return `Argument ${chalk.bold(error.argName)}: Got invalid value ${chalk.redBright(valueStr)}${
        multilineValue ? '' : ' '
      }on ${chalk.bold(`prisma.${this.children[0].name}`)}. Provided ${chalk.redBright(
        getGraphQLType(error.providedValue),
      )}, expected ${expected}`
    }

    if (error.type === 'invalidNullArg') {
      const forStr = path.length === 1 && path[0] === error.name ? '' : ` for ${chalk.bold(`${path.join('.')}`)}`
      const undefinedTip = ` Please use ${chalk.bold.greenBright('undefined')} instead.`
      return `Argument ${chalk.greenBright(error.name)}${forStr} must not be ${chalk.bold('null')}.${undefinedTip}`
    }

    if (error.type === 'missingArg') {
      const forStr = path.length === 1 && path[0] === error.missingName ? '' : ` for ${chalk.bold(`${path.join('.')}`)}`
      return `Argument ${chalk.greenBright(error.missingName)}${forStr} is missing.`
    }

    if (error.type === 'atLeastOne') {
      const additional = minimal ? '' : ` Available args are listed in ${chalk.dim.green('green')}.`
      return `Argument ${chalk.bold(path.join('.'))} of type ${chalk.bold(
        error.inputType.name,
      )} needs ${chalk.greenBright('at least one')} argument.${additional}`
    }

    if (error.type === 'atMostOne') {
      const additional = minimal
        ? ''
        : ` Please choose one. ${chalk.dim('Available args:')} \n${stringifyInputType(error.inputType, true)}`
      return `Argument ${chalk.bold(path.join('.'))} of type ${chalk.bold(
        error.inputType.name,
      )} needs ${chalk.greenBright('exactly one')} argument, but you provided ${error.providedKeys
        .map((key) => chalk.redBright(key))
        .join(' and ')}.${additional}`
    }

    return undefined
  }
  /**
   * As we're allowing both single objects and array of objects for list inputs, we need to remove incorrect
   * zero indexes from the path
   * @param inputPath e.g. ['where', 'AND', 0, 'id']
   * @param select select object
   */
  private normalizePath(inputPath: Array<string | number>, select: any) {
    const path = inputPath.slice()
    const newPath: Array<string | number> = []
    let key: undefined | string | number
    let pointer = select
    while ((key = path.shift()) !== undefined) {
      if (!Array.isArray(pointer) && key === 0) {
        continue
      }
      if (key === 'select') {
        // TODO: Remove this logic! It shouldn't be needed
        if (!pointer[key]) {
          pointer = pointer.include
        } else {
          pointer = pointer[key]
        }
      } else if (pointer && pointer[key]) {
        pointer = pointer[key]
      }

      newPath.push(key)
    }
    return newPath
  }
}

export class PrismaClientValidationError extends Error {
  get [Symbol.toStringTag]() {
    return 'PrismaClientValidationError'
  }
}
export class PrismaClientConstructorValidationError extends Error {
  constructor(message: string) {
    super(message + `\nRead more at https://pris.ly/d/client-constructor`)
  }
  get [Symbol.toStringTag]() {
    return 'PrismaClientConstructorValidationError'
  }
}

export interface FieldArgs {
  name: string
  schemaField?: DMMF.SchemaField // optional as we want to even build up invalid queries to collect all errors
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
  public readonly schemaField?: DMMF.SchemaField
  constructor({ name, args, children, error, schemaField }: FieldArgs) {
    this.name = name
    this.args = args
    this.children = children
    this.error = error
    this.schemaField = schemaField
    this.hasInvalidChild = children
      ? children.some((child) => Boolean(child.error || child.hasInvalidArg || child.hasInvalidChild))
      : false
    this.hasInvalidArg = args ? args.hasInvalidArg : false
  }
  get [Symbol.toStringTag]() {
    return 'Field'
  }
  public toString() {
    let str = this.name

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
  public collectErrors(prefix = 'select'): {
    fieldErrors: FieldError[]
    argErrors: ArgError[]
  } {
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
        const errors = child.collectErrors(prefix)
        // Field -> Field always goes through a 'select'
        fieldErrors.push(
          ...errors.fieldErrors.map((e) => ({
            ...e,
            path: [this.name, prefix, ...e.path],
          })),
        )
        argErrors.push(
          ...errors.argErrors.map((e) => ({
            ...e,
            path: [this.name, prefix, ...e.path],
          })),
        )
      }
    }

    // get all errors from args
    if (this.args) {
      argErrors.push(...this.args.collectErrors().map((e) => ({ ...e, path: [this.name, ...e.path] })))
    }

    return {
      fieldErrors,
      argErrors,
    }
  }
}

export class Args {
  public args: Arg[]
  public readonly hasInvalidArg: boolean
  constructor(args: Arg[] = []) {
    this.args = args
    this.hasInvalidArg = args ? args.some((arg) => Boolean(arg.hasError)) : false
  }
  get [Symbol.toStringTag]() {
    return 'Args'
  }
  public toString() {
    if (this.args.length === 0) {
      return ''
    }
    return `${this.args
      .map((arg) => arg.toString())
      .filter((a) => a)
      .join('\n')}`
  }
  public collectErrors(): ArgError[] {
    if (!this.hasInvalidArg) {
      return []
    }

    return flatMap(this.args, (arg) => arg.collectErrors())
  }
}

/**
 * Custom stringify which turns undefined into null - needed by GraphQL
 * @param value to stringify
 * @param _
 * @param tab
 */
function stringify(value: any, inputType?: DMMF.SchemaArgInputType) {
  if (Buffer.isBuffer(value)) {
    return JSON.stringify(value.toString('base64'))
  }

  if (Object.prototype.toString.call(value) === '[object BigInt]') {
    return value.toString()
  }

  if (typeof inputType?.type === 'string' && inputType.type === 'Json') {
    if (value === null) {
      return 'null'
    }
    if (value && value.values && value.__prismaRawParamaters__) {
      return JSON.stringify(value.values)
    }
    if (inputType?.isList && Array.isArray(value)) {
      return JSON.stringify(value.map((o) => JSON.stringify(o)))
    }
    // because we send json as a string
    return JSON.stringify(JSON.stringify(value))
  }

  if (value === undefined) {
    // TODO: This is a bit weird. can't we unify this with the === null caes?
    return null
  }

  if (value === null) {
    return 'null'
  }

  if (Decimal.isDecimal(value) || (inputType?.type === 'Decimal' && isDecimalJsLike(value))) {
    return stringifyDecimalJsLike(value)
  }

  if (inputType?.location === 'enumTypes' && typeof value === 'string') {
    if (Array.isArray(value)) {
      return `[${value.join(', ')}]`
    }
    return value
  }

  return JSON.stringify(value, null, 2)
}

interface ArgOptions {
  key: string
  value: ArgValue
  isEnum?: boolean
  error?: InvalidArgError
  schemaArg?: DMMF.SchemaArg
  inputType?: DMMF.SchemaArgInputType
}

export class Arg {
  public key: string
  // not readonly, as we later need to transform it
  public value: ArgValue
  public error?: InvalidArgError
  public hasError: boolean
  public isEnum: boolean
  public schemaArg?: DMMF.SchemaArg
  public isNullable: boolean
  public inputType?: DMMF.SchemaArgInputType

  constructor({ key, value, isEnum = false, error, schemaArg, inputType }: ArgOptions) {
    this.inputType = inputType
    this.key = key
    this.value = value
    this.isEnum = isEnum
    this.error = error
    this.schemaArg = schemaArg
    this.isNullable =
      schemaArg?.inputTypes.reduce<boolean>((isNullable) => isNullable && schemaArg.isNullable, true) || false
    this.hasError =
      Boolean(error) ||
      (value instanceof Args ? value.hasInvalidArg : false) ||
      (Array.isArray(value) && value.some((v) => (v instanceof Args ? v.hasInvalidArg : false)))
  }
  get [Symbol.toStringTag]() {
    return 'Arg'
  }
  public _toString(value: ArgValue, key: string): string | undefined {
    if (typeof value === 'undefined') {
      return undefined
    }

    if (value instanceof Args) {
      return `${key}: {
${indent(value.toString(), 2)}
}`
    }

    if (Array.isArray(value)) {
      if (this.inputType?.type === 'Json') {
        return `${key}: ${stringify(value, this.inputType)}`
      }

      const isScalar = !(value as any[]).some((v) => typeof v === 'object')
      return `${key}: [${isScalar ? '' : '\n'}${indent(
        (value as any[])
          .map((nestedValue) => {
            if (nestedValue instanceof Args) {
              return `{\n${indent(nestedValue.toString(), tab)}\n}`
            }
            return stringify(nestedValue, this.inputType)
          })
          .join(`,${isScalar ? ' ' : '\n'}`),
        isScalar ? 0 : tab,
      )}${isScalar ? '' : '\n'}]`
    }

    return `${key}: ${stringify(value, this.inputType)}`
  }
  public toString() {
    return this._toString(this.value, this.key)
  }
  // TODO: memoize this function
  public collectErrors(): ArgError[] {
    if (!this.hasError) {
      return []
    }

    const errors: ArgError[] = []

    // add the own arg
    if (this.error) {
      const id =
        typeof this.inputType?.type === 'object'
          ? `${this.inputType.type.name}${this.inputType.isList ? '[]' : ''}`
          : undefined
      errors.push({
        error: this.error,
        path: [this.key],
        id,
      })
    }

    if (Array.isArray(this.value)) {
      errors.push(
        ...(flatMap(this.value as any[], (val, index) => {
          if (!val?.collectErrors) {
            return []
          }

          return val.collectErrors().map((e) => {
            return { ...e, path: [this.key, index, ...e.path] }
          })
        }) as any),
      )
    }

    // collect errors of children if there are any
    if (this.value instanceof Args) {
      errors.push(...this.value.collectErrors().map((e) => ({ ...e, path: [this.key, ...e.path] })))
    }

    return errors
  }
}

export type ArgValue = string | boolean | number | undefined | Args | string[] | boolean[] | number[] | Args[] | null

export interface DocumentInput {
  dmmf: DMMFHelper
  rootTypeName: 'query' | 'mutation'
  rootField: string
  select?: any
}

export function makeDocument({ dmmf, rootTypeName, rootField, select }: DocumentInput): Document {
  if (!select) {
    select = {}
  }
  const rootType = rootTypeName === 'query' ? dmmf.queryType : dmmf.mutationType
  // Create a fake toplevel field for easier implementation
  const fakeRootField: DMMF.SchemaField = {
    args: [],
    outputType: {
      isList: false,
      type: rootType,
      location: 'outputObjectTypes',
    },
    name: rootTypeName,
  }
  const children = selectionToFields(dmmf, { [rootField]: select }, fakeRootField, [rootTypeName])
  return new Document(rootTypeName, children) as any
}

// TODO: get rid of this function
export function transformDocument(document: Document): Document {
  return document
}

export function selectionToFields(
  dmmf: DMMFHelper,
  selection: any,
  schemaField: DMMF.SchemaField,
  path: string[],
): Field[] {
  const outputType = schemaField.outputType.type as DMMF.OutputType
  return Object.entries(selection).reduce((acc, [name, value]: any) => {
    const field = outputType.fieldMap ? outputType.fieldMap[name] : outputType.fields.find((f) => f.name === name)

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
            didYouMean: getSuggestion(
              name,
              outputType.fields.map((f) => f.name),
            ),
            outputType,
          },
        }),
      )

      return acc
    }

    if (
      typeof value !== 'boolean' &&
      field.outputType.location === 'scalar' &&
      field.name !== 'executeRaw' &&
      field.name !== 'queryRaw' &&
      field.name !== 'runCommandRaw' &&
      outputType.name !== 'Query' &&
      !name.startsWith('aggregate') &&
      field.name !== 'count' // TODO: Find a cleaner solution
    ) {
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

    const transformedField = {
      name: field.name,
      fields: field.args,
      constraints: {
        minNumFields: null,
        maxNumFields: null,
      },
    }
    const argsWithoutIncludeAndSelect = typeof value === 'object' ? omit(value, ['include', 'select']) : undefined
    const args = argsWithoutIncludeAndSelect
      ? objectToArgs(
          argsWithoutIncludeAndSelect,
          transformedField,
          [],
          typeof field === 'string' ? undefined : (field.outputType.type as DMMF.OutputType),
        )
      : undefined
    const isRelation = field.outputType.location === 'outputObjectTypes'

    // TODO: use default selection for `include` again

    // check for empty select
    if (value) {
      if (value.select && value.include) {
        acc.push(
          new Field({
            name,
            children: [
              new Field({
                name: 'include',
                args: new Args(),
                error: {
                  type: 'includeAndSelect',
                  field,
                },
              }),
            ],
          }),
        )
      } else if (value.include) {
        const keys = Object.keys(value.include)

        if (keys.length === 0) {
          acc.push(
            new Field({
              name,
              children: [
                new Field({
                  name: 'include',
                  args: new Args(),
                  error: {
                    type: 'emptyInclude',
                    field,
                  },
                }),
              ],
            }),
          )

          return acc
        }

        // TODO: unify with select validation logic
        /**
         * Error handling for `include` statements
         */
        if (field.outputType.location === 'outputObjectTypes') {
          const fieldOutputType = field.outputType.type as DMMF.OutputType
          const allowedKeys = fieldOutputType.fields
            .filter((f) => f.outputType.location === 'outputObjectTypes')
            .map((f) => f.name)
          const invalidKeys = keys.filter((key) => !allowedKeys.includes(key))
          if (invalidKeys.length > 0) {
            acc.push(
              ...invalidKeys.map(
                (invalidKey) =>
                  new Field({
                    name: invalidKey,
                    children: [
                      new Field({
                        name: invalidKey,
                        args: new Args(),
                        error: {
                          type: 'invalidFieldName',
                          modelName: fieldOutputType.name,
                          outputType: fieldOutputType,
                          providedName: invalidKey,
                          didYouMean: getSuggestion(invalidKey, allowedKeys) || undefined,
                          isInclude: true,
                          isIncludeScalar: fieldOutputType.fields.some((f) => f.name === invalidKey),
                        },
                      }),
                    ],
                    // @ts-ignore
                  }),
              ),
            )
            return acc
          }
        }
      } else if (value.select) {
        const values = Object.values(value.select)
        if (values.length === 0) {
          acc.push(
            new Field({
              name,
              children: [
                new Field({
                  name: 'select',
                  args: new Args(),
                  error: {
                    type: 'emptySelect',
                    field,
                  },
                }),
              ],
            }),
          )

          return acc
        }

        // check if there is at least one truthy value
        const truthyValues = values.filter((v) => v)
        if (truthyValues.length === 0) {
          acc.push(
            new Field({
              name,
              children: [
                new Field({
                  name: 'select',
                  args: new Args(),
                  error: {
                    type: 'noTrueSelect',
                    field,
                  },
                }),
              ],
            }),
          )

          return acc
        }
      }
    }
    // either use select or default selection, but not both at the same time
    const defaultSelection = isRelation ? getDefaultSelection(dmmf, field.outputType.type as DMMF.OutputType) : null

    let select = defaultSelection
    if (value) {
      if (value.select) {
        select = value.select
      } else if (value.include) {
        select = deepExtend(defaultSelection, value.include)
        /**
         * special case for group by:
         * The "by" is an array of fields like ["email", "name"]
         * We turn that into a select statement of that form:
         * {
         *   "email": true,
         *   "name": true,
         * }
         */
      } else if (
        value.by &&
        Array.isArray(value.by) &&
        field.outputType.namespace === 'prisma' &&
        field.outputType.location === 'outputObjectTypes' &&
        isGroupByOutputName((field.outputType.type as DMMF.OutputType).name)
      ) {
        select = byToSelect(value.by)
      }
    }

    const children =
      select !== false && isRelation ? selectionToFields(dmmf, select, field, [...path, name]) : undefined

    acc.push(new Field({ name, args, children, schemaField: field }))

    return acc
  }, [] as Field[])
}

function byToSelect(by: string[]): Record<string, true> {
  const obj = Object.create(null)
  for (const b of by) {
    obj[b] = true
  }
  return obj
}

function getDefaultSelection(dmmf: DMMFHelper, outputType: DMMF.OutputType) {
  const acc = Object.create(null)

  for (const f of outputType.fields) {
    if (dmmf.typeMap[(f.outputType.type as DMMF.OutputType).name] !== undefined) {
      acc[f.name] = true // by default, we load composite fields
    }
    if (f.outputType.location === 'scalar' || f.outputType.location === 'enumTypes') {
      acc[f.name] = true // by default, we load all scalar fields
    }
  }

  return acc
}

function getInvalidTypeArg(
  key: string,
  value: any,
  arg: DMMF.SchemaArg,
  bestFittingType: DMMF.SchemaArgInputType,
): Arg {
  const arrg = new Arg({
    key,
    value: getSerializableValue(value),
    isEnum: bestFittingType.location === 'enumTypes',
    inputType: bestFittingType,
    error: {
      type: 'invalidType',
      providedValue: value,
      argName: key,
      requiredType: {
        inputType: arg.inputTypes,
        bestFittingType,
      },
    },
  })

  return arrg
}

// TODO: Refactor
function hasCorrectScalarType(value: any, arg: DMMF.SchemaArg, inputType: DMMF.SchemaArgInputType): boolean {
  const { type, isList } = inputType
  const expectedType = wrapWithList(stringifyGraphQLType(type), isList)
  const graphQLType = getGraphQLType(value, inputType)

  if (graphQLType === expectedType) {
    return true
  }

  if (isList && graphQLType === 'List<>') {
    return true
  }

  if (expectedType === 'Json' && graphQLType !== 'Symbol') {
    return true
  }

  if (graphQLType === 'Int' && expectedType === 'BigInt') {
    return true
  }

  if (graphQLType === 'List<Int>' && expectedType === 'List<BigInt>') {
    return true
  }

  if (graphQLType === 'List<BigInt | Int>' && expectedType === 'List<BigInt>') {
    return true
  }

  if (graphQLType === 'List<Int | BigInt>' && expectedType === 'List<BigInt>') {
    return true
  }

  if ((graphQLType === 'Int' || graphQLType === 'Float') && expectedType === 'Decimal') {
    return true
  }

  if (isValidDecimalListInput(graphQLType, value) && expectedType === 'List<Decimal>') {
    return true
  }

  // DateTime is a subset of string
  if (graphQLType === 'DateTime' && expectedType === 'String') {
    return true
  }
  if (graphQLType === 'List<DateTime>' && expectedType === 'List<String>') {
    return true
  }

  // UUID is a subset of string
  if (graphQLType === 'UUID' && expectedType === 'String') {
    return true
  }
  if (graphQLType === 'List<UUID>' && expectedType === 'List<String>') {
    return true
  }

  if (graphQLType === 'String' && expectedType === 'ID') {
    return true
  }
  if (graphQLType === 'List<String>' && expectedType === 'List<ID>') {
    return true
  }

  if (graphQLType === 'List<String>' && expectedType === 'List<Json>') {
    return true
  }

  if (
    expectedType === 'List<String>' &&
    (graphQLType === 'List<String | UUID>' || graphQLType === 'List<UUID | String>')
  ) {
    return true
  }

  // Int is a subset of Float
  if (graphQLType === 'Int' && expectedType === 'Float') {
    return true
  }
  if (graphQLType === 'List<Int>' && expectedType === 'List<Float>') {
    return true
  }
  // Int is a subset of Long
  if (graphQLType === 'Int' && expectedType === 'Long') {
    return true
  }
  if (graphQLType === 'List<Int>' && expectedType === 'List<Long>') {
    return true
  }

  // to match all strings which are valid decimals
  if (graphQLType === 'String' && expectedType === 'Decimal' && isDecimalString(value)) {
    return true
  }

  if (value === null) {
    return true
  }

  return false
}

const cleanObject = (obj) => filterObject(obj, (k, v) => v !== undefined)

function isValidDecimalListInput(graphQLType: string, value: any[]): boolean {
  return (
    graphQLType === 'List<Int>' ||
    graphQLType === 'List<Float>' ||
    (graphQLType === 'List<String>' && value.every(isDecimalString))
  )
}

function isDecimalString(value: string): boolean {
  // from https://github.com/MikeMcl/decimal.js/blob/master/decimal.js#L116
  return /^\-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i.test(value)
}

function valueToArg(key: string, value: any, arg: DMMF.SchemaArg): Arg | null {
  /**
   * Go through the possible union input types.
   * Stop on the first successful one
   */
  let maybeArg: Arg | null = null

  const argsWithErrors: { arg: Arg; errors: ArgError[] }[] = []

  for (const inputType of arg.inputTypes) {
    maybeArg = tryInferArgs(key, value, arg, inputType)
    if (maybeArg?.collectErrors().length === 0) {
      return maybeArg
    }
    if (maybeArg && maybeArg?.collectErrors()) {
      const argErrors = maybeArg?.collectErrors()
      if (argErrors && argErrors.length > 0) {
        argsWithErrors.push({ arg: maybeArg, errors: argErrors })
      }
    }
  }

  if (maybeArg?.hasError && argsWithErrors.length > 0) {
    const argsWithScores = argsWithErrors.map(({ arg, errors }) => {
      const errorScores = errors.map((e) => {
        let score = 1

        if (e.error.type === 'invalidType') {
          // Math.exp is important here so a big depth is exponentially punished
          score = 2 * Math.exp(getDepth(e.error.providedValue)) + 1
        }

        score += Math.log(e.path.length)

        if (e.error.type === 'missingArg') {
          if (arg.inputType && isInputArgType(arg.inputType.type) && arg.inputType.type.name.includes('Unchecked')) {
            score *= 2
          }
        }

        if (e.error.type === 'invalidName') {
          if (isInputArgType(e.error.originalType)) {
            if (e.error.originalType.name.includes('Unchecked')) {
              score *= 2
            }
          }
        }

        // we use (1 / path.length) to make sure that this only makes a difference
        // in the cases, where the rest is the same
        return score
      })

      return {
        score: errors.length + sum(errorScores),
        arg,
        errors,
      }
    })

    argsWithScores.sort((a, b) => (a.score < b.score ? -1 : 1))

    return argsWithScores[0].arg
  }

  return maybeArg
}

function getDepth(object: any): number {
  let level = 1
  if (!object || typeof object !== 'object') {
    return level
  }
  for (const key in object) {
    if (!Object.prototype.hasOwnProperty.call(object, key)) {
      continue
    }

    if (typeof object[key] === 'object') {
      const depth = getDepth(object[key]) + 1
      level = Math.max(depth, level)
    }
  }
  return level
}

function sum(n: number[]): number {
  return n.reduce((acc, curr) => acc + curr, 0)
}

/**
 * Running through the possible input types of a union.
 * @param key
 * @param value
 * @param arg
 * @param inputType
 */
function tryInferArgs(key: string, value: any, arg: DMMF.SchemaArg, inputType: DMMF.SchemaArgInputType): Arg | null {
  if (typeof value === 'undefined') {
    // the arg is undefined and not required - we're fine
    if (!arg.isRequired) {
      return null
    }

    // the provided value is 'undefined' but shouldn't be
    return new Arg({
      key,
      value,
      isEnum: inputType.location === 'enumTypes',
      inputType,
      error: {
        type: 'missingArg',
        missingName: key,
        missingArg: arg,
        atLeastOne: false,
        atMostOne: false,
      },
    })
  }

  const { isNullable, isRequired } = arg

  if (value === null && !isNullable && !isRequired) {
    // we don't need to execute this ternery if not necessary
    const isAtLeastOne = isInputArgType(inputType.type)
      ? inputType.type.constraints.minNumFields !== null && inputType.type.constraints.minNumFields > 0
      : false
    if (!isAtLeastOne) {
      return new Arg({
        key,
        value,
        isEnum: inputType.location === 'enumTypes',
        inputType,
        error: {
          type: 'invalidNullArg',
          name: key,
          invalidType: arg.inputTypes,
          atLeastOne: false,
          atMostOne: false,
        },
      })
    }
  }

  // then the first
  if (!inputType.isList) {
    if (isInputArgType(inputType.type)) {
      if (
        typeof value !== 'object' ||
        Array.isArray(value) ||
        (inputType.location === 'inputObjectTypes' && !isObject(value))
      ) {
        return getInvalidTypeArg(key, value, arg, inputType)
      } else {
        const val = cleanObject(value)
        let error: AtMostOneError | AtLeastOneError | undefined
        const keys = Object.keys(val || {})
        const numKeys = keys.length

        if (
          numKeys === 0 &&
          typeof inputType.type.constraints.minNumFields === 'number' &&
          inputType.type.constraints.minNumFields > 0
        ) {
          // continue here
          error = {
            type: 'atLeastOne',
            key,
            inputType: inputType.type,
          }
        } else if (
          numKeys > 1 &&
          typeof inputType.type.constraints.maxNumFields === 'number' &&
          inputType.type.constraints.maxNumFields < 2
        ) {
          error = {
            type: 'atMostOne',
            key,
            inputType: inputType.type,
            providedKeys: keys,
          }
        }

        return new Arg({
          key,
          value: val === null ? null : objectToArgs(val, inputType.type, arg.inputTypes),
          isEnum: inputType.location === 'enumTypes',
          error,
          inputType,
          schemaArg: arg,
        })
      }
    } else {
      return scalarToArg(key, value, arg, inputType)
    }
  }

  // the provided arg should be a list, but isn't
  // that's fine for us as we can just turn this into a list with a single item
  // and GraphQL even allows this. We're going the conservative route though
  // and actually generate the [] around the value

  if (!Array.isArray(value) && inputType.isList) {
    // TODO: This "if condition" is just a hack until the query engine is fixed
    if (key !== 'updateMany') {
      value = [value]
    }
  }

  if (inputType.location === 'enumTypes' || inputType.location === 'scalar') {
    // if no value is incorrect
    return scalarToArg(key, value, arg, inputType)
  }

  const argInputType = inputType.type as DMMF.InputType
  const hasAtLeastOneError =
    typeof argInputType.constraints?.minNumFields === 'number' && argInputType.constraints?.minNumFields > 0
      ? Array.isArray(value) && value.some((v) => !v || Object.keys(cleanObject(v)).length === 0)
      : false
  let err: AtLeastOneError | undefined | AtMostOneError = hasAtLeastOneError
    ? {
        inputType: argInputType,
        key,
        type: 'atLeastOne',
      }
    : undefined
  if (!err) {
    const hasOneOfError =
      typeof argInputType.constraints?.maxNumFields === 'number' && argInputType.constraints?.maxNumFields < 2
        ? Array.isArray(value) && value.find((v) => !v || Object.keys(cleanObject(v)).length !== 1)
        : false
    if (hasOneOfError) {
      err = {
        inputType: argInputType,
        key,
        type: 'atMostOne',
        providedKeys: Object.keys(hasOneOfError),
      }
    }
  }

  if (!Array.isArray(value)) {
    for (const nestedArgInputType of arg.inputTypes) {
      const args = objectToArgs(value, nestedArgInputType.type as DMMF.InputType)
      if (args.collectErrors().length === 0) {
        return new Arg({
          key,
          value: args,
          isEnum: false,
          schemaArg: arg,
          inputType: nestedArgInputType,
        })
      }
    }
  }

  return new Arg({
    key,
    value: value.map((v) => {
      if (inputType.isList && typeof v !== 'object') {
        return v
      }
      if (typeof v !== 'object' || !value) {
        return getInvalidTypeArg(key, v, arg, inputType)
      }
      return objectToArgs(v, argInputType)
    }),
    isEnum: false,
    inputType,
    schemaArg: arg,
    error: err,
  })
}

export function isInputArgType(argType: DMMF.ArgType): argType is DMMF.InputType {
  if (typeof argType === 'string') {
    return false
  }

  if (Object.hasOwnProperty.call(argType, 'values')) {
    return false
  }

  return true
}

function scalarToArg(key: string, value: any, arg: DMMF.SchemaArg, inputType: DMMF.SchemaArgInputType): Arg {
  if (hasCorrectScalarType(value, arg, inputType)) {
    return new Arg({
      key,
      value: getSerializableValue(value),
      isEnum: inputType.location === 'enumTypes',
      schemaArg: arg,
      inputType,
    })
  }
  return getInvalidTypeArg(key, value, arg, inputType)
}

function getSerializableValue(value: any): any {
  if (typeof value === 'symbol') {
    return value.description
  }
  return value
}

function objectToArgs(
  initialObj: any,
  inputType: DMMF.InputType,
  possibilities?: DMMF.SchemaArgInputType[],
  outputType?: DMMF.OutputType,
): Args {
  // filter out undefined values and treat them if they weren't provided
  const obj = cleanObject(initialObj)
  const { fields: args, fieldMap } = inputType
  const requiredArgs: any = args.map((arg) => [arg.name, undefined])
  const objEntries = Object.entries(obj || {})
  const entries = unionBy(objEntries, requiredArgs, (a) => a[0])
  const argsList = entries.reduce((acc, [argName, value]: any) => {
    const schemaArg = fieldMap ? fieldMap[argName] : args.find((a) => a.name === argName)
    if (!schemaArg) {
      const didYouMeanField =
        typeof value === 'boolean' && outputType && outputType.fields.some((f) => f.name === argName) ? argName : null
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
              (!didYouMeanField && getSuggestion(argName, [...args.map((a) => a.name), 'select'])) || undefined,
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
  }, [] as Arg[])
  // Also show optional neighbour args, if there is any arg missing
  if (
    (typeof inputType.constraints.minNumFields === 'number' &&
      objEntries.length < inputType.constraints.minNumFields) ||
    argsList.find((arg) => arg.error?.type === 'missingArg' || arg.error?.type === 'atLeastOne')
  ) {
    const optionalMissingArgs = inputType.fields.filter(
      (field) => !field.isRequired && obj && (typeof obj[field.name] === 'undefined' || obj[field.name] === null),
    )
    argsList.push(
      ...optionalMissingArgs.map((arg) => {
        const argInputType = arg.inputTypes[0]
        return new Arg({
          key: arg.name,
          value: undefined,
          isEnum: argInputType.location === 'enumTypes',
          error: {
            type: 'missingArg',
            missingName: arg.name,
            missingArg: arg,
            atLeastOne: Boolean(inputType.constraints.minNumFields) || false,
            atMostOne: inputType.constraints.maxNumFields === 1 || false,
          },
          inputType: argInputType,
        })
      }),
    )
  }
  return new Args(argsList)
}

export interface UnpackOptions {
  document: Document
  path: string[]
  data: any
}

/**
 * Unpacks the result of a data object and maps DateTime fields to instances of `Date` inplace
 * @param options: UnpackOptions
 */
export function unpack({ document, path, data }: UnpackOptions): any {
  const result = deepGet(data, path)

  if (result === 'undefined') {
    return null
  }

  if (typeof result !== 'object') {
    return result
  }

  const field = getField(document, path)

  return mapScalars({ field, data: result })
}

export interface MapScalarsOptions {
  field: Field
  data: any
}

export function mapScalars({ field, data }: MapScalarsOptions): any {
  if (!data || typeof data !== 'object' || !field.children || !field.schemaField) {
    return data
  }

  const deserializers = {
    DateTime: (value) => new Date(value),
    Json: (value) => JSON.parse(value),
    Bytes: (value) => Buffer.from(value, 'base64'),
    Decimal: (value) => {
      return new Decimal(value)
    },
    BigInt: (value) => BigInt(value),
  }

  for (const child of field.children) {
    const outputType = child.schemaField?.outputType.type
    if (outputType && typeof outputType === 'string') {
      const deserializer = deserializers[outputType]
      if (deserializer) {
        if (Array.isArray(data)) {
          for (const entry of data) {
            // in the very unlikely case, that a field is not there in the result, ignore it
            if (typeof entry[child.name] !== 'undefined' && entry[child.name] !== null) {
              // for scalar lists
              if (Array.isArray(entry[child.name])) {
                entry[child.name] = entry[child.name].map(deserializer)
              } else {
                entry[child.name] = deserializer(entry[child.name])
              }
            }
          }
        } else {
          // same here, ignore it if it's undefined
          if (typeof data[child.name] !== 'undefined' && data[child.name] !== null) {
            // for scalar lists
            if (Array.isArray(data[child.name])) {
              data[child.name] = data[child.name].map(deserializer)
            } else {
              data[child.name] = deserializer(data[child.name])
            }
          }
        }
      }
    }

    if (child.schemaField && child.schemaField.outputType.location === 'outputObjectTypes') {
      if (Array.isArray(data)) {
        for (const entry of data) {
          mapScalars({ field: child, data: entry[child.name] })
        }
      } else {
        mapScalars({ field: child, data: data[child.name] })
      }
    }
  }

  return data
}

export function getField(document: Document, path: string[]): Field {
  const todo = path.slice() // let's create a copy to not fiddle with the input argument
  const firstElement = todo.shift()
  // this might be slow because of the find
  let pointer = document.children.find((c) => c.name === firstElement)

  if (!pointer) {
    throw new Error(`Could not find field ${firstElement} in document ${document}`)
  }

  while (todo.length > 0) {
    const key = todo.shift()
    if (!pointer!.children) {
      throw new Error(`Can't get children for field ${pointer} with child ${key}`)
    }
    const child = pointer!.children.find((c) => c.name === key)
    if (!child) {
      throw new Error(`Can't find child ${key} of field ${pointer}`)
    }
    pointer = child
  }

  return pointer!
}

function removeSelectFromPath(path: string): string {
  return path
    .split('.')
    .filter((p) => p !== 'select')
    .join('.')
}

function removeSelectFromObject(obj: object): object {
  const type = Object.prototype.toString.call(obj)
  if (type === '[object Object]') {
    const copy = {}
    for (const key in obj) {
      if (key === 'select') {
        for (const subKey in obj['select']) {
          copy[subKey] = removeSelectFromObject(obj['select'][subKey])
        }
      } else {
        copy[key] = removeSelectFromObject(obj[key])
      }
    }
    return copy
  }

  return obj
}

function transformAggregatePrintJsonArgs({
  ast,
  keyPaths,
  missingItems,
  valuePaths,
}: PrintJsonWithErrorsArgs): PrintJsonWithErrorsArgs {
  const newKeyPaths = keyPaths.map(removeSelectFromPath)
  const newValuePaths = valuePaths.map(removeSelectFromPath)
  const newMissingItems = missingItems.map((item) => ({
    path: removeSelectFromPath(item.path),
    isRequired: item.isRequired,
    type: item.type,
  }))

  const newAst = removeSelectFromObject(ast)
  return {
    ast: newAst,
    keyPaths: newKeyPaths,
    missingItems: newMissingItems,
    valuePaths: newValuePaths,
  }
}
