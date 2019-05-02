import indent from 'indent-string'
import { merge, omit } from 'lodash'
import chalk from 'chalk'
import { printJsonErrors } from './printJsonErrors'
import { dedent } from './dedent'
import { dmmf, DMMFClass } from './dmmf'
import { DMMF } from './dmmf-types'
import { performance } from 'perf_hooks'

const tab = 2

class Document {
  constructor(protected type: 'query' | 'mutation', protected children: Field[]) {}
  toString() {
    return `${this.type} {
${indent(this.children.map(String).join('\n'), tab)}
}`
  }
}

class Field {
  constructor(public readonly name: string, public readonly args?: Args, public readonly children?: Field[]) {}
  toString() {
    let str = this.name

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
}

class Args {
  constructor(public args?: Arg[]) {}
  toString() {
    if (!this.args || this.args.length === 0) {
      return ''
    }
    return `${this.args.map(String).join(', ')}`
  }
}

class Arg {
  constructor(protected key: string, protected value: ArgType) {}
  toString() {
    if (this.value instanceof Args) {
      return `${this.key}: { ${this.value} }`
    }
    return `${this.key}: ${JSON.stringify(this.value)}`
  }
}

type ArgType = string | boolean | number | Args

interface DocumentInput {
  dmmf: DMMFClass
  rootTypeName: 'query' | 'mutation'
  rootField: string
  select: any
}

function makeDocument({ dmmf, rootTypeName, rootField, select }: DocumentInput) {
  const rootType = rootTypeName === 'query' ? dmmf.queryType : dmmf.mutationType
  return new Document(rootTypeName, selectionToFields(dmmf, { [rootField]: select }, rootType, [rootTypeName]))
}

// TODO: refactor to use the model and not the path
function selectionToFields(dmmf: DMMFClass, selection: any, model: DMMF.MergedOutputType, path: string[]): Field[] {
  return Object.entries(selection).reduce(
    (acc, [name, value]: any) => {
      if (value === false) {
        return acc
      }
      const argsWithoutSelect = value ? omit(value, 'select') : undefined
      const args = argsWithoutSelect ? objectToArgs(argsWithoutSelect) : undefined
      const model = getModelForPath(dmmf, [...path, name])
      const defaultSelection = model ? getDefaultSelection(dmmf, model) : {}
      const select = merge(defaultSelection, value.select)
      const fields = select !== false && model ? selectionToFields(dmmf, select, model, [...path, name]) : undefined
      acc.push(new Field(name, args, fields))

      return acc
    },
    [] as Field[],
  )
}

function getModelForPath(dmmf: DMMFClass, path: string[]): null | any {
  if (path.length <= 1) {
    return null
  }
  const root: string = path.shift()!
  const rootMap: any = {
    query: 'queries',
    mutation: 'mutations',
  }

  const queryName = path.shift()!
  const query = dmmf.schema[rootMap[root]].find(q => q.name === queryName)
  const typeName = query.output.name

  let model = getModel(dmmf, typeName)

  if (path.length === 0) {
    return model
  }

  while (path.length > 0) {
    const fieldName = path.shift()
    const field = model.fields.find(f => f.name === fieldName)
    model = getModel(dmmf, field.type)
  }

  return model
}

function getModel(dmmf: any, modelName: string) {
  return dmmf.datamodel.models.find((m: any) => m.name === modelName)
}

function getDefaultSelection(dmmf: any, model: any) {
  return model.fields.reduce((acc: any, f: any) => {
    if (f.kind === 'scalar') {
      acc[f.name] = true
    } else {
      // otherwise field is a relation. let's look up, if it's an embedded type
      const model = getModel(dmmf, f.type)
      if (model && model.isEmbedded) {
        acc[f.name] = { select: getDefaultSelection(dmmf, model) }
      }
    }

    return acc
  }, {})
}

function objectToArgs(obj: any): Args {
  const entries = Object.entries(obj)
  return new Args(
    entries.map(([argName, value]) => {
      if (typeof value === 'object') {
        return new Arg(argName, objectToArgs(value))
      }
      return new Arg(argName, value)
    }),
  )
}

function main() {
  console.clear()
  // const document = new Document('query', [
  //   new Field(
  //     'users',
  //     new Args([
  //       new Arg('first', 100),
  //       new Arg('skip', 200),
  //       new Arg('where', new Args([new Arg('age_gt', 10), new Arg('email_endsWith', '@gmail.com')])),
  //     ]),
  //     [
  //       new Field('id'),
  //       new Field('name'),

  //       new Field('friends', new Args(), [new Field('id'), new Field('name')]),
  //       new Field('posts', new Args([new Arg('first', 200)]), [new Field('id'), new Field('name')]),
  //     ],
  //   ),
  // ])

  const query1 = `query {
    users(first: 100, skip: 200, where: {
      age_gt: 10
      email_endsWith: "@gmail.com"
    }) {
      id
      name
      friends {
        id
        name
      }
      posts(first: 200) {
        id
      }
    }
  }
  `

  const bigAst = {
    first: 200,
    skip: 200,
    where: {
      age_gt: 10,
      email_endsWith: '@gmail.com',
    },
    select: {
      id: false,
      posts: {
        first: 100,
        where: {
          isPublished: true,
        },
        select: {
          id: false,
          author: {
            where: {
              age: {
                gt: 10,
              },
            },
            select: {
              id: true,
            },
          },
        },
      },
    },
  }

  const before = performance.now()
  const document = makeDocument({ dmmf, select: bigAst, rootTypeName: 'query', rootField: 'users' })
  const docStr = String(document)
  const after = performance.now()
  console.log(docStr)
  console.log(`needed ${after - before} ms`)

  //   const errorStr = `
  //     \nInvalid ${chalk.white.bold('`prisma.users`')} query:

  // ${printJsonErrors(bigAst, ['select.posts.select.author.select.id2'], ['where.email_endsWith'])}

  // Unkown field ${chalk.redBright('`mosts`')} on model ${chalk.bold.white('User')}. Did you mean ${chalk.greenBright(
  //     '`posts`',
  //   )}?
  // Unkown field ${chalk.redBright('`mosts2`')} on model ${chalk.bold.white('User')}. Did you mean ${chalk.greenBright(
  //     '`posts`',
  //   )}?
  //   `
}

main()
