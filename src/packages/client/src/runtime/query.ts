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
  getOutputTypeName,
  getSuggestion,
  inputTypeToJson,
  stringifyGraphQLType,
  stringifyInputType,
  unionBy,
  wrapWithList,
  isScalar,
} from './utils/common'
import { deepExtend } from './utils/deep-extend'
import { deepGet } from './utils/deep-set'
import { filterObject } from './utils/filterObject'
import { omit } from './utils/omit'
import {
  MissingItem,
  printJsonWithErrors,
  PrintJsonWithErrorsArgs,
} from './utils/printJsonErrors'
import { printStack } from './utils/printStack'
import stringifyObject from './utils/stringifyObject'
import { visit } from './visit'
import stripAnsi from 'strip-ansi'
import { flatMap } from './utils/flatMap'

const tab = 2

export class Document {
  constructor(
    public readonly type: 'query' | 'mutation',
    public readonly children: Field[],
  ) {
    this.type = type
    this.children = children
  }
  public toString() {
    return `${this.type} {
${indent(this.children.map(String).join('\n'), tab)}
}`
  }
  public validate(
    select?: any,
    isTopLevelQuery: boolean = false,
    originalMethod?: string,
    errorFormat?: 'pretty' | 'minimal' | 'colorless',
    validationCallsite?: any,
  ) {
    if (!select) {
      select = {}
    }
    const invalidChildren = this.children.filter(
      (child) => child.hasInvalidChild || child.hasInvalidArg,
    )
    if (invalidChildren.length === 0) {
      return
    }

    const fieldErrors: FieldError[] = []
    const argErrors: ArgError[] = []
    const prefix =
      select && select.select
        ? 'select'
        : select.include
          ? 'include'
          : undefined

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
          .filter((field) =>
            isInclude ? field.outputType.kind === 'object' : true,
          )
          .forEach((field) => {
            const splittedPath = path.split('.')
            missingItems.push({
              path: `${splittedPath
                .slice(0, splittedPath.length - 1)
                .join('.')}.${field.name}`,
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
        const selectPath = selectPathArray
          .slice(0, selectPathArray.length - 1)
          .join('.')

        const fieldType = fieldError.error.field.outputType
          .type as DMMF.OutputType

        fieldType.fields
          .filter((field) =>
            fieldError.error.type === 'emptyInclude'
              ? field.outputType.kind === 'object'
              : true,
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
      } else if (
        argError.error.type !== 'missingArg' &&
        argError.error.type !== 'atLeastOne'
      ) {
        valuePaths.push(path)
      } else if (argError.error.type === 'missingArg') {
        const type =
          argError.error.missingType.length === 1
            ? argError.error.missingType[0].type
            : argError.error.missingType
              .map((t) => getInputTypeName(t.type))
              .join(' | ')
        missingItems.push({
          path,
          type: inputTypeToJson(type, true, path.split('where.').length === 2),
          isRequired: argError.error.missingType[0].isRequired,
        })
      }
    }

    const renderErrorStr = (callsite?: string) => {
      const hasRequiredMissingArgsErrors = argErrors.some(
        (e) =>
          e.error.type === 'missingArg' && e.error.missingType[0].isRequired,
      )
      const hasOptionalMissingArgsErrors = argErrors.some(
        (e) =>
          e.error.type === 'missingArg' && !e.error.missingType[0].isRequired,
      )
      const hasMissingArgsErrors =
        hasOptionalMissingArgsErrors || hasRequiredMissingArgsErrors

      let missingArgsLegend = ''
      if (hasRequiredMissingArgsErrors) {
        missingArgsLegend += `\n${chalk.dim(
          'Note: Lines with ',
        )}${chalk.reset.greenBright('+')} ${chalk.dim('are required')}`
      }

      if (hasOptionalMissingArgsErrors) {
        if (missingArgsLegend.length === 0) {
          missingArgsLegend = '\n'
        }
        if (hasRequiredMissingArgsErrors) {
          missingArgsLegend += chalk.dim(
            `, lines with ${chalk.green('?')} are optional`,
          )
        } else {
          missingArgsLegend += chalk.dim(
            `Note: Lines with ${chalk.green('?')} are optional`,
          )
        }
        missingArgsLegend += chalk.dim('.')
      }

      const errorMessages = `${argErrors
        .filter(
          (e) =>
            e.error.type !== 'missingArg' || e.error.missingType[0].isRequired,
        )
        .map((e) =>
          this.printArgError(
            e,
            hasMissingArgsErrors,
            errorFormat === 'minimal',
          ),
        ) // if no callsite is provided, just render the minimal error
        .join('\n')}
${fieldErrors
          .map((e) => this.printFieldError(e, missingItems, errorFormat === 'minimal'))
          .join('\n')}`

      if (errorFormat === 'minimal') {
        return stripAnsi(errorMessages)
      }

      const { stack, indent: indentValue, afterLines } = printStack({
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

      const errorStr = `${stack}${indent(
        printJsonWithErrors(printJsonArgs),
        indentValue,
      ).slice(indentValue)}${chalk.dim(afterLines)}

${errorMessages}${missingArgsLegend}\n`

      if (process.env.NO_COLOR || errorFormat === 'colorless') {
        return stripAnsi(errorStr)
      }
      return errorStr
    }
    // end renderErrorStr definition

    const error = new PrismaClientValidationError(
      renderErrorStr(validationCallsite),
    )

    // @ts-ignore
    if (process.env.NODE_ENV !== 'production') {
      Object.defineProperty(error, 'render', {
        get: () => renderErrorStr,
        enumerable: false,
      })
    }
    throw error
  }
  protected printFieldError = (
    { error, path }: FieldError,
    missingItems: MissingItem[],
    minimal: boolean,
  ) => {
    if (error.type === 'emptySelect') {
      const additional = minimal
        ? ''
        : ` Available options are listed in ${chalk.greenBright.dim('green')}.`
      return `The ${chalk.redBright(
        '`select`',
      )} statement for type ${chalk.bold(
        getOutputTypeName(error.field.outputType.type),
      )} must not be empty.${additional}`
    }
    if (error.type === 'emptyInclude') {
      if (missingItems.length === 0) {
        return `${chalk.bold(
          getOutputTypeName(error.field.outputType.type),
        )} does not have any relation and therefore can't have an ${chalk.redBright(
          '`include`',
        )} statement.`
      }
      const additional = minimal
        ? ''
        : ` Available options are listed in ${chalk.greenBright.dim('green')}.`
      return `The ${chalk.redBright(
        '`include`',
      )} statement for type ${chalk.bold(
        getOutputTypeName(error.field.outputType.type),
      )} must not be empty.${additional}`
    }
    if (error.type === 'noTrueSelect') {
      const additional = minimal
        ? ''
        : ` Available options are listed in ${chalk.greenBright.dim('green')}.`
      return `The ${chalk.redBright(
        '`select`',
      )} statement for type ${chalk.bold(
        getOutputTypeName(error.field.outputType.type),
      )} needs ${chalk.bold('at least one truthy value')}.`
    }
    if (error.type === 'includeAndSelect') {
      return `Please ${chalk.bold('either')} use ${chalk.greenBright(
        '`include`',
      )} or ${chalk.greenBright('`select`')}, but ${chalk.redBright(
        'not both',
      )} at the same time.`
    }
    if (error.type === 'invalidFieldName') {
      const statement = error.isInclude ? 'include' : 'select'
      const wording = error.isIncludeScalar ? 'Invalid scalar' : 'Unknown'
      const additional = minimal
        ? ''
        : error.isInclude && missingItems.length === 0
          ? `\nThis model has no relations, so you can't use ${chalk.redBright(
            'include',
          )} with it.`
          : ` Available options are listed in ${chalk.greenBright.dim('green')}.`
      let str = `${wording} field ${chalk.redBright(
        `\`${error.providedName}\``,
      )} for ${chalk.bold(statement)} statement on model ${chalk.bold.white(
        error.modelName,
      )}.${additional}`

      if (error.didYouMean) {
        str += ` Did you mean ${chalk.greenBright(`\`${error.didYouMean}\``)}?`
      }

      if (error.isIncludeScalar) {
        str += `\nNote, that ${chalk.bold(
          'include',
        )} statements only accept relation fields.`
      }

      return str
    }
    if (error.type === 'invalidFieldType') {
      const str = `Invalid value ${chalk.redBright(
        `${stringifyObject(error.providedValue)}`,
      )} of type ${chalk.redBright(
        getGraphQLType(error.providedValue, undefined),
      )} for field ${chalk.bold(
        `${error.fieldName}`,
      )} on model ${chalk.bold.white(
        error.modelName,
      )}. Expected either ${chalk.greenBright('true')} or ${chalk.greenBright(
        'false',
      )}.`

      return str
    }
  }
  protected printArgError = (
    { error, path }: ArgError,
    hasMissingItems: boolean,
    minimal: boolean,
  ) => {
    if (error.type === 'invalidName') {
      let str = `Unknown arg ${chalk.redBright(
        `\`${error.providedName}\``,
      )} in ${chalk.bold(path.join('.'))} for type ${chalk.bold(
        error.outputType
          ? error.outputType.name
          : getInputTypeName(error.originalType),
      )}.`
      if (error.didYouMeanField) {
        str += `\n→ Did you forget to wrap it with \`${chalk.greenBright(
          'select',
        )}\`? ${chalk.dim(
          'e.g. ' +
          chalk.greenBright(
            `{ select: { ${error.providedName}: ${error.providedValue} } }`,
          ),
        )}`
      } else if (error.didYouMeanArg) {
        str += ` Did you mean \`${chalk.greenBright(error.didYouMeanArg)}\`?`
        if (!hasMissingItems && !minimal) {
          str +=
            ` ${chalk.dim('Available args:')}\n` +
            stringifyInputType(error.originalType, true)
        }
      } else {
        if ((error.originalType as DMMF.InputType).fields.length === 0) {
          str += ` The field ${chalk.bold(
            (error.originalType as DMMF.InputType).name,
          )} has no arguments.`
        } else if (!hasMissingItems && !minimal) {
          str +=
            ` Available args:\n\n` +
            stringifyInputType(error.originalType, true)
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
      if (error.requiredType.bestFittingType.kind === 'enum') {
        return `Argument ${chalk.bold(
          error.argName,
        )}: Provided value ${chalk.redBright(valueStr)}${
          multilineValue ? '' : ' '
          }of type ${chalk.redBright(
            getGraphQLType(error.providedValue),
          )} on ${chalk.bold(
            `prisma.${this.children[0].name}`,
          )} is not a ${chalk.greenBright(
            wrapWithList(
              stringifyGraphQLType(error.requiredType.bestFittingType.kind),
              error.requiredType.bestFittingType.isList,
            ),
          )}.
→ Possible values: ${(error.requiredType.bestFittingType
            .type as DMMF.Enum).values
            .map((v) =>
              chalk.greenBright(
                `${stringifyGraphQLType(
                  error.requiredType.bestFittingType.type,
                )}.${v}`,
              ),
            )
            .join(', ')}`
      }

      let typeStr = '.'
      if (isInputArgType(error.requiredType.bestFittingType.type)) {
        typeStr =
          ':\n' + stringifyInputType(error.requiredType.bestFittingType.type)
      }
      let expected = `${error.requiredType.inputType
        .map((t) =>
          chalk.greenBright(
            wrapWithList(
              stringifyGraphQLType(t.type),
              error.requiredType.bestFittingType.isList,
            ),
          ),
        )
        .join(' or ')}${typeStr}`
      const inputType: null | DMMF.SchemaArgInputType =
        (error.requiredType.inputType.length === 2 &&
          error.requiredType.inputType.find((t) => isInputArgType(t.type))) ||
        null
      if (inputType) {
        expected += `\n` + stringifyInputType(inputType.type, true)
      }
      return `Argument ${chalk.bold(
        error.argName,
      )}: Got invalid value ${chalk.redBright(valueStr)}${
        multilineValue ? '' : ' '
        }on ${chalk.bold(
          `prisma.${this.children[0].name}`,
        )}. Provided ${chalk.redBright(
          getGraphQLType(error.providedValue),
        )}, expected ${expected}`
    }

    if (error.type === 'invalidNullArg') {
      const forStr =
        path.length === 1 && path[0] === error.name
          ? ''
          : ` for ${chalk.bold(`${path.join('.')}`)}`
      const undefinedTip = ` Please use ${chalk.bold.greenBright(
        'undefined',
      )} instead.`
      return `Argument ${chalk.greenBright(
        error.name,
      )}${forStr} must not be ${chalk.bold('null')}.${undefinedTip}`
    }

    if (error.type === 'missingArg') {
      const forStr =
        path.length === 1 && path[0] === error.missingName
          ? ''
          : ` for ${chalk.bold(`${path.join('.')}`)}`
      return `Argument ${chalk.greenBright(
        error.missingName,
      )}${forStr} is missing.`
    }

    if (error.type === 'atLeastOne') {
      const additional = minimal
        ? ''
        : ` Available args are listed in ${chalk.dim.green('green')}.`
      return `Argument ${chalk.bold(path.join('.'))} of type ${chalk.bold(
        error.inputType.name,
      )} needs ${chalk.greenBright('at least one')} argument.${additional}`
    }

    if (error.type === 'atMostOne') {
      const additional = minimal
        ? ''
        : ` Please choose one. ${chalk.dim(
          'Available args:',
        )} \n${stringifyInputType(error.inputType, true)}`
      return `Argument ${chalk.bold(path.join('.'))} of type ${chalk.bold(
        error.inputType.name,
      )} needs ${chalk.greenBright(
        'exactly one',
      )} argument, but you provided ${error.providedKeys
        .map((key) => chalk.redBright(key))
        .join(' and ')}.${additional}`
    }
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
    // tslint:disable-next-line:no-conditional-assignment
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

export class PrismaClientValidationError extends Error { }

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
      ? children.some((child) =>
        Boolean(child.error || child.hasInvalidArg || child.hasInvalidChild),
      )
      : false
    this.hasInvalidArg = args ? args.hasInvalidArg : false
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
  public collectErrors(
    prefix = 'select',
  ): { fieldErrors: FieldError[]; argErrors: ArgError[] } {
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
      argErrors.push(
        ...this.args
          .collectErrors()
          .map((e) => ({ ...e, path: [this.name, ...e.path] })),
      )
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
    this.hasInvalidArg = args
      ? args.some((arg) => Boolean(arg.hasError))
      : false
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
 * @param obj to stringify
 * @param _
 * @param tab
 */
function stringify(
  obj,
  _?: any,
  tabbing?: string | number,
  isEnum?: boolean,
  isJson?: boolean,
) {
  if (isJson) {
    if (obj && obj.values && obj.__prismaRawParamaters__) {
      return JSON.stringify(obj.values)
    }
    return JSON.stringify(JSON.stringify(obj))
  }
  if (obj === undefined) {
    return null
  }

  if (obj === null) {
    return 'null'
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
  public key: string
  // not readonly, as we later need to transform it
  public value: ArgValue
  public error?: InvalidArgError
  public hasError: boolean
  public isEnum: boolean
  public schemaArg?: DMMF.SchemaArg
  public argType?: DMMF.ArgType
  public isNullable: boolean

  constructor({
    key,
    value,
    argType,
    isEnum = false,
    error,
    schemaArg,
  }: ArgOptions) {
    this.key = key
    this.value = value
    this.argType = argType
    this.isEnum = isEnum
    this.error = error
    this.schemaArg = schemaArg
    this.isNullable =
      schemaArg?.inputType.reduce<boolean>(
        (isNullable, inputType) => isNullable && inputType.isNullable,
        true,
      ) || false
    this.hasError =
      Boolean(error) ||
      (value instanceof Args ? value.hasInvalidArg : false) ||
      (Array.isArray(value) &&
        value.some((v) => (v instanceof Args ? v.hasInvalidArg : false)))
  }
  public _toString(value: ArgValue, key: string): string | undefined {
    if (typeof value === 'undefined') {
      return undefined
    }

    if (value instanceof Args) {
      if (
        value.args.length === 1 &&
        value.args[0].key === 'set' &&
        value.args[0].schemaArg?.inputType[0].type === 'Json'
      ) {
        return `${key}: {
  set: ${stringify(value.args[0].value, null, 2, this.isEnum, true)}
}`
      }
      return `${key}: {
${indent(value.toString(), 2)}
}`
    }

    if (Array.isArray(value)) {
      if (this.argType === 'Json') {
        return `${key}: ${stringify(
          value,
          null,
          2,
          this.isEnum,
          this.argType === 'Json',
        )}`
      }

      const isScalar = !(value as any[]).some((v) => typeof v === 'object')
      return `${key}: [${isScalar ? '' : '\n'}${indent(
        (value as any[])
          .map((nestedValue) => {
            if (nestedValue instanceof Args) {
              return `{\n${indent(nestedValue.toString(), tab)}\n}`
            }
            return stringify(nestedValue, null, 2, this.isEnum)
          })
          .join(`,${isScalar ? ' ' : '\n'}`),
        isScalar ? 0 : tab,
      )}${isScalar ? '' : '\n'}]`
    }

    return `${key}: ${stringify(
      value,
      null,
      2,
      this.isEnum,
      this.argType === 'Json',
    )}`
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
        ...(flatMap(this.value as any[], (val, index) => {
          if (!val.collectErrors) {
            return []
          }

          return val.collectErrors().map((e) => {
            return { ...e, path: [this.key, index, ...e.path] }
          })
        }) as any[]),
      )
    }

    // collect errors of children if there are any
    if (this.value instanceof Args) {
      errors.push(
        ...this.value
          .collectErrors()
          .map((e) => ({ ...e, path: [this.key, ...e.path] })),
      )
    }

    return errors
  }
}

export type ArgValue =
  | string
  | boolean
  | number
  | undefined
  | Args
  | string[]
  | boolean[]
  | number[]
  | Args[]
  | null

export interface DocumentInput {
  dmmf: DMMFClass
  rootTypeName: 'query' | 'mutation'
  rootField: string
  select?: any
}

export function makeDocument({
  dmmf,
  rootTypeName,
  rootField,
  select,
}: DocumentInput) {
  if (!select) {
    select = {}
  }
  const rootType = rootTypeName === 'query' ? dmmf.queryType : dmmf.mutationType
  // Create a fake toplevel field for easier implementation
  const fakeRootField: DMMF.SchemaField = {
    args: [],
    outputType: {
      isList: false,
      isRequired: true,
      type: rootType,
      kind: 'object',
    },
    name: rootTypeName,
  }
  const children = selectionToFields(
    dmmf,
    { [rootField]: select },
    fakeRootField,
    [rootTypeName],
  )
  return new Document(rootTypeName, children)
}

export function transformDocument(document: Document): Document {
  function transformWhereArgs(args: Args) {
    return new Args(
      args.args.map((ar) => {
        // for NOT, AND, OR
        if (isArgsArray(ar.value)) {
          // long variable name to prevent shadowing
          const value = ar.value.map((argsInstance) => {
            return transformWhereArgs(argsInstance)
          })
          return new Arg({ ...ar, value })
        } else if (ar.value instanceof Args) {
          if (ar.schemaArg && !ar.schemaArg.isRelationFilter) {
            for (let i = ar.value.args.length; i--;) {
              const a = ar.value.args[i]
              if (a.key === 'not' && (typeof a.value !== 'object' || a.argType === 'DateTime' || a.argType === 'Json')) {
                // if it's already an equals { X } do not add equals
                if (!(a.value instanceof Args)) {
                  a.value = new Args([new Arg({
                    key: 'equals',
                    value: a.value,
                    argType: a.argType,
                    schemaArg: a.schemaArg
                  })])
                }
              }
              if (a.key === 'notIn') {
                let notField = ar.value.args.find(theArg => theArg.key === 'not')
                if (!notField) {
                  notField = new Arg({
                    key: 'not',
                    value: new Args(),
                    // this is probably completely wrong, but doesn't matter, as this value is not used anymore
                    argType: a.argType,
                    // same: this is probably completely wrong, but doesn't matter, as this value is not used anymore
                    schemaArg: a.schemaArg
                  })
                  // yes we push into the array that we're looping over
                  // js will not end up in an infinite loop, don't worry
                  ar.value.args.push(notField)
                }
                // we might be ahead of time...
                if ((typeof notField.value !== 'object') || notField.argType === 'DateTime' || notField.value === null || notField.argType === 'Json') {
                  // if it's already an equals { X } do not add equals
                  if (!(notField.value instanceof Args)) {
                    notField.value = new Args([new Arg({
                      key: 'equals',
                      value: notField.value,
                      argType: notField.argType,
                      schemaArg: notField.schemaArg
                    })])
                  }
                }
                const index = (notField!.value as Args).args.findIndex(arg => arg.key === 'in')
                const inArg = new Arg({
                  key: 'in',
                  value: a.value,
                  argType: a.argType,
                  schemaArg: a.schemaArg
                })
                // merge values
                if (index > -1) {
                  (inArg.value as any).push(...(notField!.value! as Args).args[index].value as any[])
                    ; (notField!.value as Args).args[index] = inArg
                } else {
                  ; (notField!.value as Args).args.push(inArg)
                }
                // we're looping reverse, so splice is ok
                ar.value.args.splice(i, 1)
              }
            }
          }
        }
        if ((ar.isEnum || (typeof ar.argType === 'string' && isScalar(ar.argType)))) {
          if (typeof ar.value !== 'object' || ar.argType === 'DateTime' || ar.argType === 'Json' || ar.value === null) {
            // if it's already an equals { X } do not add equals
            if (!(ar.value instanceof Args)) {
              ar.value = new Args([new Arg({
                key: 'equals',
                value: ar.value,
                argType: ar.argType, // probably wrong but fine
                schemaArg: ar.schemaArg // probably wrong but fine
              })])
            }
          }
        } else if (
          typeof ar.value === 'object'
          && ar.schemaArg?.inputType[0].kind === 'object'
          // don't do the "is" nesting if we're already on a field called "is"
          && ar.key !== 'is'
          && ar.argType !== 'Json'
          // do not add `is` on ...ListRelationFilter 
          // https://github.com/prisma/prisma/issues/3342
          && !(typeof ar.schemaArg?.inputType[0].type === 'object' && ar.schemaArg?.inputType[0].type.name.includes('ListRelationFilter'))
          // don't do the "is" nesting for Json types
          && !(typeof ar.argType === 'object' && (ar.argType as DMMF.InputType)?.name?.startsWith('Json'))
          && !(typeof ar.argType === 'object' && (ar.argType as DMMF.InputType)?.name?.startsWith('NestedJson'))
        ) {
          if (ar.value instanceof Args) {
            if (!ar.value.args.find(a => a.key === 'is')) {
              ar.value = new Args([new Arg({
                key: 'is',
                value: ar.value,
                argType: ar.argType, // probably wrong but fine
                schemaArg: ar.schemaArg // probably wrong but fine
              })])
            }
          } else if (ar.value === null) {
            ar.value = new Args([new Arg({
              key: 'is',
              value: ar.value,
              argType: ar.argType, // probably wrong but fine
              schemaArg: ar.schemaArg // probably wrong but fine
            })])
          }
        }
        return ar
      })
    )
  }
  function transformUpdateArg(arg: Arg): Arg {
    const { value } = arg

    if (value instanceof Args) {
      value.args = value.args.map(ar => {
        if (ar.schemaArg?.inputType.length === 2 && 
          (
            (ar.schemaArg.inputType[0].kind === 'scalar' || ar.schemaArg.inputType[0].kind === 'enum') 
            && !(ar.value instanceof Args && ['set', 'increment', 'decrement', 'multiply', 'divide'].includes(ar.value.args[0].key))
          )
        ) {
          const operationsInputType = ar.schemaArg?.inputType[1]
          ar.argType = (operationsInputType?.type as DMMF.InputType).name
          ar.value = new Args([
            new Arg({
              key: 'set',
              value: ar.value,
              schemaArg: ar.schemaArg,
            }),
          ])
        } else if (
          ar.schemaArg?.inputType.length === 1 && ar.schemaArg?.inputType[0].type === 'Json' 
        ) {
          const operationsInputType = ar.schemaArg?.inputType[0]
          ar.argType = (operationsInputType?.type as DMMF.InputType).name
          ar.value = new Args([
            new Arg({
              key: 'set',
              value: ar.value,
              schemaArg: ar.schemaArg,
              argType: 'Json',
            }),
          ])
        }
        return ar
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
        if (isInputArgType(argType)) {
          if (argType.isWhereType && schemaArg) {
            let { value } = arg
            if (isArgsArray(arg.value)) {
              value = arg.value.map((val) => transformWhereArgs(val))
            } else if (arg.value instanceof Args) {
              value = transformWhereArgs(arg.value)
            }
            return new Arg({ ...arg, value })
          }
          if (argType.isUpdateType && schemaArg) {
            return transformUpdateArg(arg)
          }
        }

        return undefined
      },
    },
  })
}

function isArgsArray(input: any): input is Args[] {
  if (Array.isArray(input)) {
    return input.every((arg) => arg instanceof Args)
  }

  return false
}

function getFilterArgName(arg: string, filter: string) {
  if (filter === 'equals') {
    return arg
  }

  return `${arg}_${convertToSnakeCase(filter)}`
}

function convertToSnakeCase(str: string): string {
  return str
    .split(/(?=[A-Z])/)
    .join('_')
    .toLowerCase()
}

export function selectionToFields(
  dmmf: DMMFClass,
  selection: any,
  schemaField: DMMF.SchemaField,
  path: string[],
): Field[] {
  const outputType = schemaField.outputType.type as DMMF.OutputType
  return Object.entries(selection).reduce((acc, [name, value]: any) => {
    const field = outputType.fieldMap
      ? outputType.fieldMap[name]
      : outputType.fields.find((f) => f.name === name)

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
      field.outputType.kind === 'scalar' &&
      field.name !== 'executeRaw' &&
      field.name !== 'queryRaw' &&
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
    }
    const argsWithoutIncludeAndSelect =
      typeof value === 'object' ? omit(value, ['include', 'select']) : undefined
    const args = argsWithoutIncludeAndSelect
      ? objectToArgs(
        argsWithoutIncludeAndSelect,
        transformedField,
        [],
        typeof field === 'string'
          ? undefined
          : (field.outputType.type as DMMF.OutputType),
      )
      : undefined
    const isRelation = field.outputType.kind === 'object'

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
        if (field.outputType.kind === 'object') {
          const fieldOutputType = field.outputType.type as DMMF.OutputType
          const allowedKeys = fieldOutputType.fields
            .filter((f) => f.outputType.kind === 'object')
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
                          didYouMean:
                            getSuggestion(invalidKey, allowedKeys) || undefined,
                          isInclude: true,
                          isIncludeScalar: fieldOutputType.fields.some(
                            (f) => f.name === invalidKey,
                          ),
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
    const defaultSelection = isRelation
      ? getDefaultSelection(field.outputType.type as DMMF.OutputType)
      : null
    let select = defaultSelection
    if (value) {
      if (value.select) {
        select = value.select
      } else if (value.include) {
        select = deepExtend(defaultSelection, value.include)
      }
    }
    const children =
      select !== false && isRelation
        ? selectionToFields(dmmf, select, field, [...path, name])
        : undefined

    acc.push(new Field({ name, args, children, schemaField: field }))

    return acc
  }, [] as Field[])
}

function getDefaultSelection(outputType: DMMF.OutputType) {
  return outputType.fields.reduce((acc, f) => {
    if (f.outputType.kind === 'scalar' || f.outputType.kind === 'enum') {
      acc[f.name] = true
    } else {
      // otherwise field is a relation. Only continue if it's an embedded type
      // as normal types don't end up in the default selection
      if ((f.outputType.type as DMMF.OutputType).isEmbedded) {
        acc[f.name] = {
          select: getDefaultSelection(f.outputType.type as DMMF.OutputType),
        }
      }
    }

    return acc
  }, {})
}

function getInvalidTypeArg(
  key: string,
  value: any,
  arg: DMMF.SchemaArg,
  bestFittingType: DMMF.SchemaArgInputType,
): Arg {
  const arrg = new Arg({
    key,
    value,
    isEnum: bestFittingType.kind === 'enum',
    argType: bestFittingType.type,
    error: {
      type: 'invalidType',
      providedValue: value,
      argName: key,
      requiredType: {
        inputType: arg.inputType,

        bestFittingType,
      },
    },
  })

  return arrg
}

function hasCorrectScalarType(
  value: any,
  arg: DMMF.SchemaArg,
  inputType: DMMF.SchemaArgInputType,
): boolean {
  const { type } = inputType
  const isList = arg.inputType[0].isList
  const expectedType = wrapWithList(stringifyGraphQLType(type), isList)
  const graphQLType = getGraphQLType(value, type)

  if (isList && graphQLType === 'List<>') {
    return true
  }

  if (expectedType === 'Json') {
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
  if (
    expectedType === 'List<String>' &&
    (graphQLType === 'List<String | UUID>' ||
      graphQLType === 'List<UUID | String>')
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

  if (graphQLType === expectedType) {
    return true
  }

  if (!inputType.isRequired && value === null) {
    return true
  }
  return false
}

const cleanObject = (obj) => filterObject(obj, (k, v) => v !== undefined)

function valueToArg(key: string, value: any, arg: DMMF.SchemaArg): Arg | null {
  const argInputType = arg.inputType[0]
  if (typeof value === 'undefined') {
    // the arg is undefined and not required - we're fine
    if (!argInputType.isRequired) {
      return null
    }

    // the provided value is 'undefined' but shouldn't be
    return new Arg({
      key,
      value,
      isEnum: argInputType.kind === 'enum',
      error: {
        type: 'missingArg',
        missingName: key,
        missingType: arg.inputType,
        atLeastOne: false,
        atMostOne: false,
      },
    })
  }

  if (value === null && arg.inputType.length === 1) {
    const t = arg.inputType[0]
    if (isInputArgType(t.type) && t.type.isOrderType) {
      return null
    }
  }

  // optimization of [0] and [1] as we know, that we only have max 2 input types
  // if null is provided but not allowed, let the user know in an error.
  const isNullable =
    arg.inputType[0].isNullable ||
    (arg.inputType.length > 1 ? arg.inputType[1].isNullable : false)
  const isRequired =
    arg.inputType[0].isRequired ||
    (arg.inputType.length > 1 ? arg.inputType[1].isRequired : false)
  if (value === null && !isNullable && !isRequired) {
    // we don't need to execute this ternery if not necessary
    const isAtLeastOne = isInputArgType(arg.inputType[0].type)
      ? arg.inputType[0].type.atLeastOne
      : false
    if (!isAtLeastOne) {
      return new Arg({
        key,
        value,
        isEnum: argInputType.kind === 'enum',
        error: {
          type: 'invalidNullArg',
          name: key,
          invalidType: arg.inputType,
          atLeastOne: false,
          atMostOne: false,
        },
      })
    }
  }

  // then the first
  if (!argInputType.isList) {
    const args = arg.inputType.map((t) => {
      if (isInputArgType(t.type)) {
        if (typeof value !== 'object') {
          return getInvalidTypeArg(key, value, arg, t)
        } else {
          let val = cleanObject(value)
          if (t.type.isWhereType && val) {
            for (const field of t.type.fields) {
              if (field.nullEqualsUndefined && val[field.name] === null) {
                delete val[field.name] // it's fine to touch val, as it's already a copy here
              }
            }
          }
          if (t.type.isOrderType) {
            val = filterObject(val, (k, v) => v !== null)
          }
          let error: AtMostOneError | AtLeastOneError | undefined
          const keys = Object.keys(val || {})
          const numKeys = keys.length

          if (numKeys === 0 && t.type.atLeastOne) {
            error = {
              type: 'atLeastOne',
              key,
              inputType: t.type,
            }
          } else if (numKeys > 1 && t.type.isOneOf) {
            error = {
              type: 'atMostOne',
              key,
              inputType: t.type,
              providedKeys: keys,
            }
          } else if (numKeys > 1 && t.type.atMostOne) {
            error = {
              type: 'atMostOne',
              key,
              inputType: t.type,
              providedKeys: keys,
            }
          }

          return new Arg({
            key,
            value:
              val === null ? null : objectToArgs(val, t.type, arg.inputType),
            isEnum: argInputType.kind === 'enum',
            error,
            argType: t.type,
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
    const argWithoutError = args.find((a) => !a.hasError)
    if (argWithoutError) {
      return argWithoutError
    }

    const hasSameKind = (argType: DMMF.ArgType, val: any) => {
      if (val === null && (argType === 'null' || !isInputArgType(argType))) {
        return true
      }
      return isInputArgType(argType)
        ? typeof val === 'object'
        : typeof val !== 'object'
    }

    /**
     * If there are more than 1 args, do the following:
     * First check if there are any possible arg types which at least have the
     * correct base type (scalar, null or object)
     * Take either these, or if they don't exist just again the normal args and
     * take the arg with the minimum amount of errors
     */
    if (args.length > 1) {
      const argsWithSameKind = args.filter((a) =>
        hasSameKind(a.argType!, value),
      )
      const argsToFilter = argsWithSameKind.length > 0 ? argsWithSameKind : args

      const argWithMinimumErrors = argsToFilter.reduce<{
        arg: null | Arg
        numErrors: number
      }>(
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
  }

  if (arg.inputType.length > 1) {
    throw new Error(`List types with union input types are not supported`)
  }

  // the provided arg should be a list, but isn't
  // that's fine for us as we can just turn this into a list with a single item
  // and GraphQL even allows this. We're going the conservative route though
  // and actually generate the [] around the value

  if (!Array.isArray(value)) {
    if (key === 'OR' && arg.name === 'OR' && arg.isRelationFilter) {
      return scalarToArg(key, value, arg, argInputType)
    }
    value = [value]
  }

  if (argInputType.kind === 'enum' || argInputType.kind === 'scalar') {
    // if no value is incorrect
    return scalarToArg(key, value, arg, argInputType)
  }

  const inputType = argInputType.type as DMMF.InputType
  const hasAtLeastOneError = inputType.atLeastOne
    ? value.some((v) => !v || Object.keys(cleanObject(v)).length === 0)
    : false
  let err: AtLeastOneError | undefined | AtMostOneError = hasAtLeastOneError
    ? {
      inputType,
      key,
      type: 'atLeastOne',
    }
    : undefined
  if (!err) {
    const hasOneOfError = inputType.isOneOf
      ? value.find((v) => !v || Object.keys(cleanObject(v)).length !== 1)
      : false
    if (hasOneOfError) {
      err = {
        inputType,
        key,
        type: 'atMostOne',
        providedKeys: Object.keys(hasOneOfError),
      }
    }
  }
  return new Arg({
    key,
    value: value.map((v) => {
      if (typeof v !== 'object' || !value) {
        return getInvalidTypeArg(key, v, arg, argInputType)
      }
      return objectToArgs(v, argInputType.type as DMMF.InputType)
    }),
    isEnum: false,
    argType: argInputType.type,
    schemaArg: arg,
    error: err,
  })
}

export function isInputArgType(
  argType: DMMF.ArgType,
): argType is DMMF.InputType {
  if (typeof argType === 'string') {
    return false
  }
  if (argType.hasOwnProperty('values')) {
    return false
  }

  return true
}

function scalarToArg(
  key: string,
  value: any,
  arg: DMMF.SchemaArg,
  inputType: DMMF.SchemaArgInputType,
): Arg {
  if (hasCorrectScalarType(value, arg, inputType)) {
    return new Arg({
      key,
      value,
      isEnum: arg.inputType[0].kind === 'enum',
      argType: inputType.type,
      schemaArg: arg,
    })
  }
  return getInvalidTypeArg(key, value, arg, inputType)
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
  const requiredArgs: any = args
    .filter((arg) => arg.inputType.some((t) => t.isRequired))
    .map((arg) => [arg.name, undefined])
  const entries = unionBy(Object.entries(obj || {}), requiredArgs, (a) => a[0])
  const argsList = entries.reduce((acc, [argName, value]: any) => {
    const schemaArg = fieldMap
      ? fieldMap[argName]
      : args.find((a) => a.name === argName)
    if (!schemaArg) {
      const didYouMeanField =
        typeof value === 'boolean' &&
          outputType &&
          outputType.fields.some((f) => f.name === argName)
          ? argName
          : null
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
              (!didYouMeanField &&
                getSuggestion(argName, [
                  ...args.map((a) => a.name),
                  'select',
                ])) ||
              undefined,
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
    (entries.length === 0 && inputType.atLeastOne) ||
    argsList.find((arg) => arg.error && arg.error.type === 'missingArg')
  ) {
    const optionalMissingArgs = inputType.fields.filter(
      (arg) => !entries.some(([entry]) => entry === arg.name),
    )
    argsList.push(
      ...optionalMissingArgs.map((arg) => {
        const argInputType = arg.inputType[0]
        return new Arg({
          key: arg.name,
          value: undefined,
          isEnum: argInputType.kind === 'enum',
          error: {
            type: 'missingArg',
            missingName: arg.name,
            missingType: arg.inputType,
            atLeastOne: inputType.atLeastOne || false,
            atMostOne: inputType.atMostOne || false,
          },
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

  const mappedData = mapDates({ field, data: result })
  return mapJson({ field, data: mappedData })
}

export interface MapDatesOptions {
  field: Field
  data: any
}

export function mapDates({ field, data }: MapDatesOptions): any {
  if (
    !data ||
    typeof data !== 'object' ||
    !field.children ||
    !field.schemaField
  ) {
    return data
  }

  for (const child of field.children) {
    if (child.schemaField && child.schemaField.outputType.type === 'DateTime') {
      if (Array.isArray(data)) {
        for (const entry of data) {
          // in the very unlikely case, that a field is not there in the result, ignore it
          if (typeof entry[child.name] !== 'undefined') {
            entry[child.name] = entry[child.name]
              ? new Date(entry[child.name])
              : entry[child.name]
          }
        }
      } else {
        // same here, ignore it if it's undefined
        if (typeof data[child.name] !== 'undefined') {
          data[child.name] = data[child.name]
            ? new Date(data[child.name])
            : data[child.name]
        }
      }
    }

    if (child.schemaField && child.schemaField.outputType.kind === 'object') {
      if (Array.isArray(data)) {
        for (const entry of data) {
          mapDates({ field: child, data: entry[child.name] })
        }
      } else {
        mapDates({ field: child, data: data[child.name] })
      }
    }
  }

  return data
}

export function mapJson({ field, data }: MapDatesOptions): any {
  if (
    !data ||
    typeof data !== 'object' ||
    !field.children ||
    !field.schemaField
  ) {
    return data
  }

  for (const child of field.children) {
    if (child.schemaField && child.schemaField.outputType.type === 'Json') {
      if (Array.isArray(data)) {
        for (const entry of data) {
          // in the very unlikely case, that a field is not there in the result, ignore it
          if (typeof entry[child.name] !== 'undefined') {
            entry[child.name] = entry[child.name]
              ? JSON.parse(entry[child.name])
              : entry[child.name]
          }
        }
      } else {
        // same here, ignore it if it's undefined
        if (typeof data[child.name] !== 'undefined') {
          data[child.name] = data[child.name]
            ? JSON.parse(data[child.name])
            : data[child.name]
        }
      }
    }

    if (child.schemaField && child.schemaField.outputType.kind === 'object') {
      if (Array.isArray(data)) {
        for (const entry of data) {
          mapJson({ field: child, data: entry[child.name] })
        }
      } else {
        mapJson({ field: child, data: data[child.name] })
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
    throw new Error(
      `Could not find field ${firstElement} in document ${document}`,
    )
  }

  while (todo.length > 0) {
    const key = todo.shift()
    if (!pointer!.children) {
      throw new Error(
        `Can't get children for field ${pointer} with child ${key}`,
      )
    }
    const child = pointer!.children.find((c) => c.name === key)
    if (!child) {
      throw new Error(`Can't find child ${key} of field ${pointer}`)
    }
    pointer = child!
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
