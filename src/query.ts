import indent from 'indent-string'
import { merge, omit } from 'lodash'
import chalk from 'chalk'
import { printJsonErrors } from './printJsonErrors'
import { dedent } from './dedent'
import { dmmf, DMMFClass } from './dmmf'
import { DMMF } from './dmmf-types'
import { performance } from 'perf_hooks'
import {
  getSuggestion,
  GraphQLScalarToJSTypeTable,
  graphQLToJSType,
  getGraphQLType,
  stringifyGraphQLType,
} from './utils'
import { InvalidArgError, ArgError, FieldError, InvalidFieldNameError } from './types'

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
        valuePaths.push(argError.path.join('.'))
      }
    }
    // valuePaths.push(...['users.where.name_in.0'])
    // valuePaths.push(...['users.where.AND.0.age_gt'])
    // valuePaths.push(...['users.where.AND.1.AND'])
    // valuePaths.push(...['users.where.AND.1.AND.0.age_gt'])

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
      return `Argument ${chalk.bold(error.argName)}: Got invalid value ${chalk.redBright(
        stringify(error.providedValue),
      )} on query ${chalk.bold('prisma.users')}. Provided ${chalk.redBright(
        getGraphQLType(error.providedValue),
      )}, expected ${chalk.greenBright(
        stringifyGraphQLType(error.requiredType.type.toString(), error.requiredType.isList),
      )}.`
    }
  }
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
    this.hasInvalidArg = args ? args.some(arg => Boolean(arg.error)) : false
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
    this.hasError = Boolean(error) || (value instanceof Args ? value.hasInvalidArg : false)
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
      const args = argsWithoutSelect ? objectToArgs(argsWithoutSelect, field.args) : undefined
      const isRelation = !field.isScalar
      const defaultSelection = isRelation ? getDefaultSelection(field.type as DMMF.MergedOutputType) : null
      const select = merge(defaultSelection, value.select)
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

function valueToArg(key: string, value: any, arg: DMMF.SchemaArg): Arg | null {
  if (typeof value === 'undefined') {
    // the arg is undefined and not required - we're fine
    if (!arg.isRequired) {
      return null
    }

    // the provided value is 'undefined' but shouldn't be
    return new Arg(key, value, {
      type: 'missingArg',
      missingName: key,
      isScalar: arg.isScalar,
      isList: arg.isList,
      missingType: JSON.stringify(arg.type),
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
    return new Arg(key, objectToArgs(value, (arg.type as DMMF.InputType).args))
  }

  if (arg.isList && !arg.isScalar) {
    return new Arg(
      key,
      value.map(v => {
        if (typeof v !== 'object' || !value) {
          return getInvalidTypeArg(key, v, arg)
        }
        return objectToArgs(v, (arg.type as DMMF.InputType).args)
      }),
    )
  }

  // TODO: Decide for better default case
  throw new Error('Oops. This must not happen')
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
  const argType = stringifyGraphQLType(arg.type as string, arg.isList)
  const graphQLType = getGraphQLType(value)
  // DateTime is a subset of string
  if (graphQLType === 'DateTime' && argType === 'string') {
    return true
  }
  // Int is a subset of Float
  if (graphQLType === 'Int' && argType === 'Float') {
    return true
  }
  // Int is a subset of Long
  if (graphQLType === 'Int' && argType === 'Long') {
    return true
  }
  return graphQLType === argType
}

function objectToArgs(obj: any, args: DMMF.SchemaArg[]): Args {
  const entries = Object.entries(obj)
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
            }),
          )
          return acc
        }

        const arg = valueToArg(argName, value, schemaArg)

        if (arg) {
          acc.push(arg)
        } else {
          console.log(`Ignoring ${argName}`)
        }

        return acc
      },
      [] as Arg[],
    ),
  )
}

async function main() {
  console.clear()
  // const document = new Document('query', [
  //   new Field({
  //     name: 'users',
  //     args: new Args([
  //       new Arg('mirst', 100, {
  //         didYouMean: 'first',
  //         providedName: 'mirst',
  //         type: 'invalidName',
  //       }),
  //       new Arg('skip', '200', {
  //         type: 'invalidType',
  //         providedValue: '200',
  //         requiredType: {
  //           isRequired: false,
  //           type: 'number',
  //           isList: false,
  //           isScalar: false,
  //         },
  //       }),
  //       new Arg(
  //         'where',
  //         new Args([
  //           new Arg('age_gt', 10),
  //           new Arg('age_in', [1, 2, 3]),
  //           new Arg('name_in', ['hans', 'peter', 'schmidt']),
  //           new Arg('OR', [
  //             new Args([
  //               new Arg('age_gt', 10123123123),
  //               new Arg('email_endsWith', 'veryLongNameGoIntoaNewLineNow@gmail.com'),
  //             ]),
  //             new Args([
  //               new Arg('age_gt', 10123123123),
  //               new Arg('email_endsWith', 'veryLongNameGoIntoaNewLineNow@gmail.com'),
  //               new Arg('OR', [
  //                 new Args([
  //                   new Arg('age_gt', 10123123123),
  //                   new Arg('email_endsWith', 'veryLongNameGoIntoaNewLineNow@gmail.com'),
  //                 ]),
  //               ]),
  //             ]),
  //           ]),
  //         ]),
  //       ),
  //     ]),
  //     children: [
  //       new Field({ name: 'id' }),
  //       new Field({ name: 'name2', error: { modelName: 'User', didYouMean: 'name', providedName: 'name2' } }),
  //       new Field({
  //         name: 'friends',
  //         args: new Args(),
  //         children: [new Field({ name: 'id' }), new Field({ name: 'name' })],
  //       }),
  //       new Field({
  //         name: 'posts',
  //         args: new Args([new Arg('first', 200)]),
  //         children: [new Field({ name: 'id' }), new Field({ name: 'name' })],
  //       }),
  //     ],
  //   }),
  // ])
  const ast = {
    mirst: 100,
    first: '100',
    skip: ['200'],
    where: {
      age_gt: 10,
      age_in: [1, 2, 3],
      name_in: ['hans', 'peter', 'schmidt'],
      AND: [
        {
          age_gt: 10123123123,
          email_endsWith: 'veryLongNameGoIntoaNewLineNow@gmail.com',
        },
        {
          age_gt: 10123123123,
          email_endsWith: 'veryLongNameGoIntoaNewLineNow@gmail.com',
          name_contains: 'hans',
          AND: [
            {
              age_gt: '10123123123',
              email_endsWith2: 'veryLongNameGoIntoaNewLineNow@gmail.com',
            },
          ],
        },
      ],
    },
    melect: {
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
    select: {
      id: true,
      name: 'asd',
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

  const document = makeDocument({ dmmf, select: ast, rootTypeName: 'query', rootField: 'users' })
  // console.log(String(document))
  document.validate(ast, true)

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
