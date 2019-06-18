import chalk from 'chalk'
import 'flat-map-polyfill'
import indent from 'indent-string'
import * as stackTraceParser from 'stacktrace-parser'
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
import { highlightTS } from './highlight/highlight'
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
} from './utils/common'
import { dedent } from './utils/dedent'
import { deepExtend } from './utils/deep-extend'
import { deepGet } from './utils/deep-set'
import { filterObject } from './utils/filterObject'
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
      const path = this.normalizePath(fieldError.path, select).join('.')
      if (fieldError.error.type === 'invalidFieldName') {
        keyPaths.push(path)
      } else {
        valuePaths.push(path)
      }
      if (fieldError.error.type === 'emptySelect' || fieldError.error.type === 'noTrueSelect') {
        const selectPathArray = this.normalizePath(fieldError.path, select)
        const selectPath = selectPathArray.slice(0, selectPathArray.length - 1).join('.')

        const fieldType = fieldError.error.field.outputType.type as DMMF.OutputType
        fieldType.fields.forEach(field => {
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
          argError.error.missingType.length === 1
            ? argError.error.missingType[0].type
            : argError.error.missingType.map(t => getInputTypeName(t.type)).join(' | ')
        missingItems.push({
          path,
          type: inputTypeToJson(type, true, path.split('where.').length === 2),
          isRequired: argError.error.missingType[0].isRequired,
        })
      }
    }

    function renderN(n: number, max: number): string {
      const wantedLetters = String(max).length
      const hasLetters = String(n).length
      if (hasLetters >= wantedLetters) {
        return String(n)
      }

      return String(' '.repeat(wantedLetters - hasLetters) + n)
    }
    let lastErrorHeight = 20

    const renderErrorStr = (callsite?: string) => {
      let callsiteStr = ':'
      let prevLines = '\n'
      let afterLines = ''
      let indentValue = 0
      let functionName = `photon.${originalMethod || queryName}()`

      // @ts-ignore
      if (callsite && typeof window === 'undefined') {
        const stack = stackTraceParser.parse(callsite)
        // TODO: more resilient logic to check that it's not relative to cwd
        const trace = stack.find(
          t =>
            t.file &&
            !t.file.includes('@generated') &&
            !t.methodName.includes('new ') &&
            t.methodName.split('.').length < 4,
        )
        if (process.env.NODE_ENV !== 'production' && trace && trace.file && trace.lineNumber && trace.column) {
          const fileName = trace.file
          const lineNumber = trace.lineNumber
          callsiteStr = callsite ? ` in ${chalk.underline(`${trace.file}:${trace.lineNumber}:${trace.column}`)}` : ''
          const height = process.stdout.rows || 20
          const start = Math.max(0, lineNumber - 5)
          const neededHeight = lastErrorHeight + lineNumber - start
          if (height > neededHeight) {
            const fs = require('fs')
            if (fs.existsSync(fileName)) {
              const file = fs.readFileSync(fileName, 'utf-8')
              const slicedFile = file
                .split('\n')
                .slice(start, lineNumber)
                .join('\n')
              const lines = dedent(slicedFile).split('\n')

              const theLine = lines[lines.length - 1]
              const photonRegex = /(=|return)+\s+(await)?\s*(.*\()/
              const match = theLine.match(photonRegex)
              if (match) {
                functionName = `${match[3]})`
              }
              const slicePoint = theLine.indexOf('{')
              const highlightedLines = highlightTS(
                lines
                  .map((l, i, all) =>
                    i === all.length - 1 ? l.slice(0, slicePoint > -1 ? slicePoint : l.length - 1) : l,
                  )
                  .join('\n'),
              ).split('\n')
              prevLines =
                '\n' +
                highlightedLines
                  .map((l, i) => chalk.grey(renderN(i + start + 1, lineNumber + start + 1) + ' ') + chalk.reset() + l)
                  .join('\n')
              afterLines = ')'
              indentValue = String(lineNumber + start + 1).length + getIndent(theLine) + 1
            }
          }
        }
      }

      function getIndent(line: string) {
        let spaceCount = 0
        for (let i = 0; i < line.length; i++) {
          if (line.charAt(i) !== ' ') {
            return spaceCount
          }
          spaceCount++
        }

        return spaceCount
      }

      const hasRequiredMissingArgsErrors = argErrors.some(
        e => e.error.type === 'missingArg' && e.error.missingType[0].isRequired,
      )
      const hasOptionalMissingArgsErrors = argErrors.some(
        e => e.error.type === 'missingArg' && !e.error.missingType[0].isRequired,
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
        missingArgsLegend += chalk.dim(`, lines with ${chalk.green('?')} are optional`)
        missingArgsLegend += chalk.dim('.')
      }

      const errorStr = `\n${chalk.red(`Invalid ${chalk.bold(`\`${functionName}\``)} invocation${callsiteStr}`)}
${chalk.dim(prevLines)}${chalk.reset()}${indent(
        printJsonWithErrors(
          isTopLevelQuery ? { [topLevelQueryName]: select } : select,
          keyPaths,
          valuePaths,
          missingItems,
        ),
        indentValue,
      ).slice(indentValue)}${chalk.dim(afterLines)}

${argErrors
  .filter(e => e.error.type !== 'missingArg' || e.error.missingType[0].isRequired)
  .map(e => this.printArgError(e, hasMissingArgsErrors))
  .join('\n')}
${fieldErrors.map(this.printFieldError).join('\n')}${missingArgsLegend}\n`
      lastErrorHeight = errorStr.split('\n').length
      return errorStr
    }

    const error = new PhotonError(renderErrorStr())
    // @ts-ignore
    if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
      Object.defineProperty(error, 'render', {
        get: () => renderErrorStr,
        enumerable: false,
      })
    }
    throw error
  }
  protected printFieldError = ({ error, path }: FieldError) => {
    if (error.type === 'emptySelect') {
      return `The ${chalk.redBright('`select`')} statement for type ${chalk.bold(
        getOutputTypeName(error.field.outputType.type),
      )} must not be empty. Available options are listed in ${chalk.greenBright.dim('green')}.`
    }
    if (error.type === 'noTrueSelect') {
      return `The ${chalk.redBright('`select`')} statement for type ${chalk.bold(
        getOutputTypeName(error.field.outputType.type),
      )} needs ${chalk.bold('at least one truthy value')}. Available options are listed in ${chalk.greenBright.dim(
        'green',
      )}.`
    }
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
  protected printArgError = ({ error, path }: ArgError, hasMissingItems: boolean) => {
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
        if (!hasMissingItems) {

        str += ` ${chalk.dim('Available args:')}\n` + stringifyInputType(error.originalType, true)
        }
      } else {
        if ((error.originalType as DMMF.InputType).fields.length === 0) {
          str += ` The field ${chalk.bold((error.originalType as DMMF.InputType).name)} has no arguments.`
        } else if (!hasMissingItems) {
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
      if (error.requiredType.bestFittingType.kind === 'enum') {
        return `Argument ${chalk.bold(error.argName)}: Provided value ${chalk.redBright(valueStr)}${
          multilineValue ? '' : ' '
        }of type ${chalk.redBright(getGraphQLType(error.providedValue))} on ${chalk.bold(
          `photon.${this.children[0].name}`,
        )} is not a ${chalk.greenBright(
          wrapWithList(
            stringifyGraphQLType(error.requiredType.bestFittingType.kind),
            error.requiredType.bestFittingType.isList,
          ),
        )}.
→ Possible values: ${(error.requiredType.bestFittingType.type as DMMF.Enum).values
          .map(v => chalk.greenBright(`${stringifyGraphQLType(error.requiredType.bestFittingType.type)}.${v}`))
          .join(', ')}`
      }

      let typeStr = '.'
      if (isInputArgType(error.requiredType.bestFittingType.type)) {
        typeStr = ':\n' + stringifyInputType(error.requiredType.bestFittingType.type)
      }
      let expected = `${error.requiredType.inputType
        .map(t =>
          chalk.greenBright(wrapWithList(stringifyGraphQLType(t.type), error.requiredType.bestFittingType.isList)),
        )
        .join(' or ')}${typeStr}`
      const inputType: null | DMMF.SchemaArgInputType =
        (error.requiredType.inputType.length === 2 && error.requiredType.inputType.find(t => isInputArgType(t.type))) ||
        null
      if (inputType) {
        expected += `\n` + stringifyInputType(inputType.type, true)
      }
      return `Argument ${chalk.bold(error.argName)}: Got invalid value ${chalk.redBright(valueStr)}${
        multilineValue ? '' : ' '
      }on ${chalk.bold(`photon.${this.children[0].name}`)}. Provided ${chalk.redBright(
        getGraphQLType(error.providedValue),
      )}, expected ${expected}`
    }

    if (error.type === 'missingArg') {
      return `Argument ${chalk.greenBright(error.missingName)} for ${chalk.bold(
        `${path.join('.')}`,
      )} is missing.`
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
      pointer = pointer[key]
      newPath.push(key)
    }
    return newPath
  }
}

class PhotonError extends Error {}

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
        fieldErrors.push(...errors.fieldErrors.map(e => ({ ...e, path: [this.name, prefix, ...e.path] })))
        argErrors.push(...errors.argErrors.map(e => ({ ...e, path: [this.name, prefix, ...e.path] })))
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
    return `${this.args
      .map(arg => arg.toString())
      .filter(a => a)
      .join('\n')}`
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
  const children = selectionToFields(dmmf, { [rootField]: select }, fakeRootField, [rootTypeName])
  return new Document(rootTypeName, children)
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
                  /**
                   * This is an ugly hack. It assumes, that deeploy somewhere must be a valid inputType for
                   * this argument
                   */
                  argType: deepGet(ar, ['value', 'args', '0', 'argType']),
                  schemaArg: ar.schemaArg,
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
        // if (arg.key === 'Albums') {
        //   console.log('Albums', arg)
        // }
        // if (arg.key === 'Tracks') {
        //   console.log('Tracks', arg)
        // }
        // if (arg.key === 'some') {
        //   console.log('some', arg)
        // }
        const { argType, schemaArg } = arg
        if (!argType) {
          return undefined
        }
        if (isInputArgType(argType)) {
          if (argType.isOrderType) {
            return transformOrderArg(arg)
          }

          if (argType.isWhereType && schemaArg) {
            let value
            if (isArgsArray(arg.value)) {
              value = arg.value.map(val => transformWhereArgs(val))
            } else if (arg.value instanceof Args) {
              value = transformWhereArgs(arg.value)
            }
            return new Arg({ ...arg, value })
          }
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
  const outputType = schemaField.outputType.type as DMMF.OutputType
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
      if (typeof value !== 'boolean' && field.outputType.kind === 'scalar') {
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
      const argsWithoutSelect = typeof value === 'object' ? omit(value, 'select') : undefined
      const args = argsWithoutSelect
        ? objectToArgs(
            argsWithoutSelect,
            transformedField,
            [],
            typeof field === 'string' ? undefined : (field.outputType.type as DMMF.OutputType),
          )
        : undefined
      const isRelation = field.outputType.kind === 'object'
      // use default selection for `include` again
      if (value && value.select) {
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
        const truthyValues = values.filter(v => v)
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
      // either use select or default selection, but not both at the same time
      const defaultSelection = isRelation ? getDefaultSelection(field.outputType.type as DMMF.OutputType) : null
      const select = value && value.select ? value.select : defaultSelection
      const children =
        select !== false && isRelation ? selectionToFields(dmmf, select, field, [...path, name]) : undefined
      acc.push(new Field({ name, args, children }))

      return acc
    },
    [] as Field[],
  )
}

function getDefaultSelection(outputType: DMMF.OutputType) {
  return outputType.fields.reduce((acc, f) => {
    if (f.outputType.kind === 'scalar') {
      acc[f.name] = true
    } else {
      // otherwise field is a relation. Only continue if it's an embedded type
      // as normal types don't end up in the default selection
      if ((f.outputType.type as DMMF.OutputType).isEmbedded) {
        acc[f.name] = { select: getDefaultSelection(f.outputType.type as DMMF.OutputType) }
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

function hasCorrectScalarType(value: any, arg: DMMF.SchemaArg, inputType: DMMF.SchemaArgInputType): boolean {
  const { type } = inputType
  const expectedType = wrapWithList(stringifyGraphQLType(type), arg.inputType[0].isList)
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

const cleanObject = obj => filterObject(obj, (k, v) => v !== undefined)

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

  // TODO: this is not 100% accurate as there could be other types with isList fales are true
  // then the first
  if (!argInputType.isList) {
    const args = arg.inputType.map(t => {
      if (isInputArgType(t.type)) {
        if (typeof value !== 'object') {
          return getInvalidTypeArg(key, value, arg, t)
        } else {
          const val = cleanObject(value)
          let error: AtMostOneError | AtLeastOneError | undefined
          const keys = Object.keys(val || {})
          const numKeys = keys.length
          if (numKeys === 0 && t.type.atLeastOne) {
            error = {
              type: 'atLeastOne',
              key,
              inputType: t.type,
            }
          }
          if (numKeys > 1 && t.type.atMostOne) {
            error = {
              type: 'atMostOne',
              key,
              inputType: t.type,
              providedKeys: keys,
            }
          }
          return new Arg({
            key,
            value: objectToArgs(val, t.type, arg.inputType),
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
    const argWithoutError = args.find(a => !a.hasError)
    if (argWithoutError) {
      return argWithoutError
    }

    const hasSameKind = (argType: DMMF.ArgType, val: any) => {
      if (val === null && (argType === 'null' || !isInputArgType(argType))) {
        return true
      }
      return isInputArgType(argType) ? typeof val === 'object' : typeof val !== 'object'
    }

    /**
     * If there are more than 1 args, do the following:
     * First check if there are any possible arg types which at least have the
     * correct base type (scalar, null or object)
     * Take either these, or if they don't exist just again the normal args and
     * take the arg with the minimum amount of errors
     */
    if (args.length > 1) {
      const argsWithSameKind = args.filter(a => hasSameKind(a.argType!, value))
      const argsToFilter = argsWithSameKind.length > 0 ? argsWithSameKind : args

      const argWithMinimumErrors = argsToFilter.reduce<{ arg: null | Arg; numErrors: number }>(
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
    value = [value]
  }

  if (argInputType.kind === 'enum' || argInputType.kind === 'scalar') {
    // if no value is incorrect
    return scalarToArg(key, value, arg, argInputType)
  }

  const inputType = argInputType.type as DMMF.InputType
  const hasAtLeastOneError = inputType.atLeastOne ? value.some(v => Object.keys(cleanObject(v)).length === 0) : false
  const err: AtLeastOneError | undefined = hasAtLeastOneError
    ? {
        inputType,
        key,
        type: 'atLeastOne',
      }
    : undefined
  return new Arg({
    key,
    value: value.map(v => {
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

export function isInputArgType(argType: DMMF.ArgType): argType is DMMF.InputType {
  if (typeof argType === 'string') {
    return false
  }
  if (argType.hasOwnProperty('values')) {
    return false
  }

  return true
}

function scalarToArg(key: string, value: any, arg: DMMF.SchemaArg, inputType: DMMF.SchemaArgInputType): Arg {
  if (hasCorrectScalarType(value, arg, inputType)) {
    return new Arg({ key, value, isEnum: arg.inputType[0].kind === 'enum', argType: inputType.type, schemaArg: arg })
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
  // TODO: think about using JSON.parse(JSON.stringify()) upfront instead to simplify things
  const obj = cleanObject(initialObj)
  const { fields: args } = inputType
  const requiredArgs: any = args.filter(arg => arg.inputType.some(t => t.isRequired)).map(arg => [arg.name, undefined])
  const entries = unionBy(Object.entries(obj || {}), requiredArgs, a => a[0])
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
    const optionalMissingArgs = inputType.fields.filter(arg => !entries.some(([entry]) => entry === arg.name))
    argsList.push(
      ...optionalMissingArgs.map(arg => {
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
