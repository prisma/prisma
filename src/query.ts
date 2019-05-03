import indent from 'indent-string'
import { merge, omit } from 'lodash'
import chalk from 'chalk'
import { printJsonErrors } from './printJsonErrors'
import { dedent } from './dedent'
import { dmmf, DMMFClass } from './dmmf'
import { DMMF } from './dmmf-types'
import { performance } from 'perf_hooks'
import { getSuggestion } from './utils'

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

    // console.dir({ fieldErrors, argErrors }, { depth: null })
    const topLevelQueryName = this.children[0].name
    const queryName = isTopLevelQuery ? this.type : topLevelQueryName
    const keyPaths = fieldErrors.map(e => e.path.join('.'))
    const valuePaths = []
    // an arg error can either be an invalid key or invalid value
    for (const argError of argErrors) {
      if (argError.error.type === 'invalidName') {
        keyPaths.push(argError.path.join('.'))
      } else {
        valuePaths.push(argError.path.join('.k'))
      }
    }

    const errorStr = `\n\nInvalid ${chalk.white.bold(`\`prisma.${queryName}\``)} invocation:

${printJsonErrors(isTopLevelQuery ? { [topLevelQueryName]: select } : select, keyPaths, valuePaths)}

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
      let str = `Unknown arg ${chalk.redBright(`\`${error.providedName}\``)} in ${chalk.bold(path.join('.'))}.`
      if (error.didYouMean) {
        str += ` Did you mean \`${chalk.greenBright(error.didYouMean)}\`?`
      }
      return str
    }

    /*
      TODO:
      - on query -> could be on field X of model Y
      - when nested query: in/for nested argument posts.some.id.gt in selection select.posts.first.
      - when deep: Invalid value for argument skip in select.posts.first
    */
    if (error.type === 'invalidType') {
      return `Invalid value ${chalk.redBright(stringify(error.providedValue))} for argument ${chalk.bold(
        'skip',
      )} on query ${chalk.bold('prisma.users')}. It is a ${typeOf(
        error.providedValue,
      )}, but must be a ${chalk.greenBright(error.requiredType.type)}.`
    }
  }
}

/**
 * Make the typeof human understandable
 * @param value to get instance of
 */
function typeOf(value) {
  if (value === null) {
    return 'null'
  }
  return typeof value
}

function stringify(value) {
  if (typeof value === 'string') {
    return `'${value}'`
  }

  return JSON.stringify(value)
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
      str += `(${this.args})`
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
    this.hasInvalidArg = args ? args.some(arg => Boolean(arg.error)) : false
  }
  toString() {
    if (this.args.length === 0) {
      return ''
    }
    return `${this.args.map(String).join(', ')}`
  }
  collectErrors(): ArgError[] {
    if (!this.hasInvalidArg) {
      return []
    }

    return this.args.flatMap(arg => arg.collectErrors())
  }
}

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

export type InvalidArgError =
  | {
      type: 'invalidName'
      providedName: string
      didYouMean?: string // if the possible names are too different and therefore just arbitrary, we don't suggest anything
    }
  | {
      type: 'invalidType'
      requiredType: {
        type: string
        isRequired: boolean
      }
      providedValue: any
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
    this.hasError = Boolean(error) || (value instanceof Args ? value.hasInvalidArg : false)
  }
  toString() {
    if (this.value instanceof Args) {
      return `${this.key}: { ${this.value} }`
    }
    return `${this.key}: ${JSON.stringify(this.value)}`
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

    // collect errors of children if there are any
    if (this.value instanceof Args) {
      errors.push(...this.value.collectErrors().map(e => ({ ...e, path: [this.key, ...e.path] })))
    }

    return errors
  }
}

export type ArgValue = string | boolean | number | Args

export interface DocumentInput {
  dmmf: DMMFClass
  rootTypeName: 'query' | 'mutation'
  rootField: string
  select: any
}

export function makeDocument({ dmmf, rootTypeName, rootField, select }: DocumentInput) {
  const rootType = rootTypeName === 'query' ? dmmf.queryType : dmmf.mutationType
  return new Document(rootTypeName, selectionToFields(dmmf, { [rootField]: select }, rootType, [rootTypeName]))
}

export function selectionToFields(
  dmmf: DMMFClass,
  selection: any,
  outputType: DMMF.MergedOutputType,
  path: string[],
): Field[] {
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
      const args = argsWithoutSelect ? objectToArgs(argsWithoutSelect) : undefined
      const isRelation = field.kind === 'relation'
      const defaultSelection = isRelation ? getDefaultSelection(field.type as DMMF.MergedOutputType) : null
      const select = merge(defaultSelection, value.select)
      const children =
        select !== false && isRelation
          ? selectionToFields(dmmf, select, field.type as DMMF.MergedOutputType, [...path, name])
          : undefined
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

function objectToArgs(obj: any): Args {
  const entries = Object.entries(obj)
  return new Args(
    entries.map(([argName, value]: any) => {
      if (typeof value === 'object') {
        return new Arg(argName, objectToArgs(value))
      }
      return new Arg(argName, value)
    }),
  )
}

async function main() {
  console.clear()
  const document = new Document('query', [
    new Field({
      name: 'users',
      args: new Args([
        new Arg('mirst', 100, {
          didYouMean: 'first',
          providedName: 'mirst',
          type: 'invalidName',
        }),
        new Arg('skip', '200', {
          type: 'invalidType',
          providedValue: '200',
          requiredType: {
            isRequired: false,
            type: 'number',
          },
        }),
        new Arg('where', new Args([new Arg('age_gt', 10), new Arg('email_endsWith', '@gmail.com')])),
      ]),
      children: [
        new Field({ name: 'id' }),
        new Field({ name: 'name2', error: { modelName: 'User', didYouMean: 'name', providedName: 'name2' } }),
        new Field({
          name: 'friends',
          args: new Args(),
          children: [new Field({ name: 'id' }), new Field({ name: 'name' })],
        }),
        new Field({
          name: 'posts',
          args: new Args([new Arg('first', 200)]),
          children: [new Field({ name: 'id' }), new Field({ name: 'name' })],
        }),
      ],
    }),
  ])
  const ast = {
    mirst: 200,
    skip: '200',
    where: {
      age_gt: 10,
      email_endsWith: '@gmail.com',
    },
    select: {
      id: true,
      name2: true,
      posts: {
        first: 200,
        select: {
          id: true,
          title: false,
        },
      },
    },
  }

  document.validate(ast)
  // const document = makeDocument({ dmmf, select: ast, rootTypeName: 'query', rootField: 'users' })

  console.log(String(document))

  // const query1 = `query {
  //   users(first: 100, skip: 200, where: {
  //     age_gt: 10
  //     email_endsWith: "@gmail.com"
  //   }) {
  //     id
  //     name
  //     friends {
  //       id
  //       name
  //     }
  //     posts(first: 200) {
  //       id
  //     }
  //   }
  // }
  // `

  // const document = makeDocument({ dmmf, select: bigAst, rootTypeName: 'query', rootField: 'users' })

  // const before = performance.now()
  // const docStr = String(document)
  // const after = performance.now()
  // console.log(docStr)
  // console.log(`needed ${after - before} ms`)

  // const errorStr = `
  //     \nInvalid ${chalk.white.bold('`prisma.users`')} invocation:

  // ${printJsonErrors(bigAst, ['select.posts.select.author.select.id2'], ['where.email_endsWith'])}

  // Unkown field ${chalk.redBright('`mosts`')} on model ${chalk.bold.white('User')}. Did you mean ${chalk.greenBright(
  //   '`posts`',
  // )}?
  // Unkown field ${chalk.redBright('`mosts2`')} on model ${chalk.bold.white('User')}. Did you mean ${chalk.greenBright(
  //   '`posts`',
  // )}?
  //   `
}

main().catch(e => console.error(e))
