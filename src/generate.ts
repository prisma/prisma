import { DMMF, BaseField } from './dmmf-types'
import { DMMFClass } from './dmmf'
import indent from 'indent-string'
import { GraphQLScalarToJSTypeTable, capitalize } from './utils/common'
import stringifyObject from './utils/stringifyObject'
import copy from 'fast-copy'

const tab = 2

const commonCode = `import { DMMF } from './dmmf-types'
import fetch from 'node-fetch'
import { DMMFClass } from './dmmf';
import { deepGet, deepSet } from './utils/deep-set';
import { makeDocument } from './query';
import { Subset } from './generated';

/**
 * Utility Types
 */

export type MergeTruthyValues<R extends object, S extends object> = {
  [key in keyof S | keyof R]: key extends false
    ? never
    : key extends keyof S
    ? S[key] extends false
      ? never
      : S[key]
    : key extends keyof R
    ? R[key]
    : never
}

export type CleanupNever<T> = { [key in keyof T]: T[key] extends never ? never : key }[keyof T]



/**
 * Subset
 * @desc From \`T\` pick properties that exist in \`U\`. Simple version of Intersection
 */
export type Subset<T, U> = { [key in keyof T]: key extends keyof U ? T[key] : never }

class PrismaFetcher {
  constructor(private readonly url: string) {}
  request<T>(query: string, path: string[] = []): Promise<T> {
    console.log(query)
    console.log(path)
    return Promise.resolve({data: {som: 'thing'}} as any)
    // return fetch(this.url, {
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({ query }),
    //   // TODO: More error handling
    // }).then(res => res.json()).then(res => path.length > 0 ? deepGet(res.data, path) : res.data)
  }
}
`

export class TSClient {
  protected readonly dmmf: DMMFClass
  constructor(protected readonly document: DMMF.Document) {
    // We make a deep clone here as otherwise we would serialize circular references
    // which we're building up in the DMMFClass
    this.dmmf = new DMMFClass(copy(document))
  }
  toString() {
    return `${commonCode}

/**
 * Client
**/

${new PrismaClientClass(this.dmmf)}

${new Query(this.dmmf, 'query')}

${Object.values(this.dmmf.modelMap)
  .map(model => new Model(model, this.dmmf).toString())
  .join('\n')}

/**
 * Deep Input Types
 */

${this.dmmf.inputTypes
  .filter(o => !this.dmmf.modelMap[o.name])
  .map(inputType => String(new InputType(inputType)))
  .join('\n')}

/**
 * DMMF
 */

const dmmf: DMMF.Document = ${JSON.stringify(this.document, null, 2)}
    `

    // /**
    //  * Output Types
    //  */

    // ${this.dmmf.outputTypes
    //   .filter(o => !this.dmmf.modelMap[o.name])
    //   .map(outputType => new OutputType(outputType, this.dmmf).toString())
    //   .join('\n')}
  }
}

// maybe shouldn't export this to prevent confusion
class PrismaClientClass {
  constructor(protected readonly dmmf: DMMFClass) {}
  toString() {
    const { dmmf } = this
    return `
// could be a class if we want to require new Prisma(...)
// export default function Prisma() {
//   return new PrismaClient(null as any)
// } 

export class Prisma {
  private fetcher?: PrismaFetcher
  private readonly dmmf: DMMFClass
  constructor() {
    this.dmmf = new DMMFClass(dmmf)
    this.fetcher = new PrismaFetcher('http://localhost:8000')
  }
  async connect() {
    // TODO: Spawn Rust
  }
  async close() {
    // TODO: Kill Rust
  }
  private _query?: QueryDelegate
  get query(): QueryDelegate {
    return this._query ? this._query: (this._query = QueryDelegate(this.dmmf, this.fetcher))
  }
${indent(
  dmmf.mappings
    .filter(m => m.findMany)
    .map(
      m => `private _${m.findMany}?: ${m.model}Delegate
get ${m.findMany}(): ${m.model}Delegate {
  return this._${m.findMany}? this._${m.findMany} : (this._${m.findMany} = ${m.model}Delegate(this.dmmf, this.fetcher))
}`,
    )
    .join('\n'),
  2,
)}
}`
  }
}

class QueryPayloadType {
  constructor(protected readonly type: OutputType) {}
  protected wrapArray(field: DMMF.SchemaField, str: string) {
    if (field.isList) {
      return `Array<${str}>`
    }
    return str
  }
  toString() {
    const { type } = this
    const { name } = type

    const relationFields = type.fields.filter(f => f.kind === 'relation' && f.name !== 'node')
    const relationFieldConditions =
      relationFields.length === 0
        ? ''
        : `\n${relationFields
            .map(f =>
              indent(
                `: P extends '${f.name}'\n? ${this.wrapArray(
                  f,
                  `${getPayloadName((f.type as DMMF.MergedOutputType).name)}<Extract${getModelArgName(
                    (f.type as DMMF.MergedOutputType).name,
                    f.isList ? DMMF.ModelAction.findMany : DMMF.ModelAction.findOne,
                  )}Select<S[P]>>`,
                )}`,
                8,
              ),
            )
            .join('\n')}`

    return `\
type ${getPayloadName(name)}<S extends ${name}Args> = S extends ${name}Args
  ? {
      [P in keyof S] ${relationFieldConditions}
        : never
    } : never
  `
  }
}

/**
 * Generates the generic type to calculate a payload based on a select statement
 */
class PayloadType {
  constructor(protected readonly type: OutputType) {}
  protected wrapArray(field: DMMF.SchemaField, str: string) {
    if (field.isList) {
      return `Array<${str}>`
    }
    return str
  }
  toString() {
    const { type } = this
    const { name } = type

    const relationFields = type.fields.filter(f => f.kind === 'relation')
    const relationFieldConditions =
      relationFields.length === 0
        ? ''
        : `\n${relationFields
            .map(f =>
              indent(
                `: P extends '${f.name}'\n? ${this.wrapArray(
                  f,
                  `${getPayloadName((f.type as DMMF.MergedOutputType).name)}<Extract${getFieldArgName(f)}Select<S[P]>>`,
                )}`,
                8,
              ),
            )
            .join('\n')}`

    return `\
type ${getPayloadName(name)}<S extends boolean | ${getSelectName(name)}> = S extends true
  ? ${name}
  : S extends ${getSelectName(name)}
  ? {
      [P in CleanupNever<MergeTruthyValues<${getDefaultName(name)}, S>>]: P extends ${getScalarsName(name)}
        ? ${name}[P]${relationFieldConditions}
        : never
    }
   : never`
  }
}

/**
 * Generates the default selection of a model
 */
class ModelDefault {
  constructor(protected readonly model: DMMF.Model, protected readonly dmmf: DMMFClass) {}
  protected isDefault(field: DMMF.Field) {
    if (field.kind === 'scalar') {
      return true
    }

    const model = this.dmmf.datamodel.models.find(m => field.type === m.name)
    return model!.isEmbedded
  }
  toString() {
    const { model } = this
    return `\
type ${getDefaultName(model.name)} = {
${indent(
  model.fields
    .filter(f => this.isDefault(f))
    .map(f => `${f.name}: true`)
    .join('\n'),
  tab,
)}
}
`
  }
}

export class Model {
  protected outputType: OutputType
  protected mapping: DMMF.Mapping
  constructor(protected readonly model: DMMF.Model, protected readonly dmmf: DMMFClass) {
    this.outputType = new OutputType(dmmf.outputTypeMap[model.name])
    this.mapping = dmmf.mappings.find(m => m.model === model.name)
  }
  protected get argsTypes() {
    const { mapping, model } = this
    const argsTypes: ArgsType[] = []
    for (const action in DMMF.ModelAction) {
      const fieldName = mapping[action]
      if (!fieldName) {
        continue
      }
      const field = this.dmmf.getField(fieldName)
      if (!field) {
        throw new Error(`Oops this must not happen. Could not find field ${fieldName} on either Query or Mutation`)
      }
      argsTypes.push(
        new ArgsType({
          name: getModelArgName(model.name, action as DMMF.ModelAction),
          args: [
            {
              name: 'select',
              type: getSelectName(model.name),
              isList: false,
              isRequired: false,
              isScalar: false,
            },
            ...field.args,
          ],
        }),
      )
    }

    // if (this.appearsInToOneRelation) {
    argsTypes.push(
      new ArgsType({
        name: `${model.name}Args`,
        args: [
          {
            name: 'select',
            type: getSelectName(model.name),
            isList: false,
            isRequired: false,
            isScalar: false,
          },
        ],
      }),
    )
    // }

    return argsTypes
  }
  toString() {
    const { model, outputType } = this

    return `
/**
 * Model ${model.name}
 */

export type ${model.name} = {
${indent(
  model.fields
    .filter(f => f.kind === 'scalar')
    .map(field => new Field(field).toString())
    .join('\n'),
  tab,
)}
}

export type ${getScalarsName(model.name)}= ${model.fields
      .filter(f => f.kind === 'scalar')
      .map(f => `'${f.name}'`)
      .join(' | ')}

export type ${getSelectName(model.name)}= {
${indent(
  outputType.fields
    .map(f => `${f.name}?: boolean` + (f.kind === 'relation' ? ` | ${getFieldArgName(f)}` : ''))
    .join('\n'),
  tab,
)}
}

${new ModelDefault(model, this.dmmf)}

${new PayloadType(this.outputType)}

${new ModelDelegate(this.outputType, this.dmmf)}

// InputTypes
${this.argsTypes.map(String).join('\n')}
`
  }
}

function getScalarsName(modelName: string) {
  return `${modelName}Scalars`
}

function getPayloadName(modelName: string) {
  return `${modelName}GetPayload`
}

function getSelectName(modelName: string) {
  return `${modelName}Select`
}

function getDefaultName(modelName: string) {
  return `${modelName}Default`
}

function getFieldArgName(field: DMMF.SchemaField): string {
  const outputType = field.type as DMMF.OutputType
  if (!field.isList) {
    return `${outputType.name}Args`
  }

  return `FindMany${outputType.name}Args`
}

// we need names for all top level args,
// as GraphQL doesn't have the concept of unnamed args
function getModelArgName(modelName: string, action: DMMF.ModelAction): string {
  switch (action) {
    case DMMF.ModelAction.findMany:
      return `FindMany${modelName}Args`
    case DMMF.ModelAction.findOne:
      return `FindOne${modelName}Args`
    case DMMF.ModelAction.upsert:
      return `${modelName}UpsertArgs`
    case DMMF.ModelAction.update:
      return `${modelName}UpdateArgs`
    case DMMF.ModelAction.updateMany:
      return `${modelName}UpdateManyArgs`
    case DMMF.ModelAction.delete:
      return `${modelName}DeleteArgs`
    case DMMF.ModelAction.create:
      return `${modelName}CreateArgs`
    case DMMF.ModelAction.deleteMany:
      return `${modelName}DeleteManyArgs`
  }
}

function getDefaultArgName(dmmf: DMMFClass, modelName: string, action: DMMF.ModelAction) {
  const mapping = dmmf.mappings.find(mapping => mapping.model === modelName)!

  const fieldName = mapping[action]
  const operation = getOperation(action)
  const queryType = operation === 'query' ? dmmf.queryType : dmmf.mutationType
  const field = queryType.fields.find(f => f.name === fieldName)
  return (field.args[0].type as DMMF.InputType).name
}

function getOperation(action: DMMF.ModelAction): 'query' | 'mutation' {
  if (action === DMMF.ModelAction.findMany || action === DMMF.ModelAction.findOne) {
    return 'query'
  }
  return 'mutation'
}

export class Query {
  constructor(protected readonly dmmf: DMMFClass, protected readonly operation: 'query' | 'mutation') {}
  toString() {
    const { dmmf, operation } = this
    const name = capitalize(operation)
    const mappings = dmmf.mappings.map(mapping => ({
      name: mapping.model,
      mapping: Object.entries(mapping).filter(([key]) => isQueryAction(key as DMMF.ModelAction, operation)),
    }))
    const queryType = operation === 'query' ? dmmf.queryType : dmmf.mutationType
    const outputType = new OutputType(queryType)
    return `\
/**
 * ${name}
 */

export type ${name}Args = {
${indent(
  mappings
    .flatMap(({ name, mapping }) =>
      mapping.map(([action, field]) => `${field}?: ${getModelArgName(name, action as DMMF.ModelAction)}`),
    )
    .join('\n'),
  tab,
)}
}

${new QueryPayloadType(outputType)}

${new QueryDelegate(outputType)}
`
  }
}
export class ModelDelegate {
  constructor(protected readonly outputType: OutputType, protected readonly dmmf: DMMFClass) {}
  toString() {
    const { fields, name } = this.outputType
    const mapping = this.dmmf.mappings.find(m => m.model === name)
    const actions = Object.entries(mapping).filter(([key, value]) => key !== 'model' && value)

    return `\
export interface ${name}Delegate {
  <T extends ${name}Args>(args: Subset<T,${name}Args>): PromiseLike<Array<${name}GetPayload<Extract${getModelArgName(
      name,
      DMMF.ModelAction.findMany,
    )}Select<T>>>>
${indent(
  actions
    .map(
      ([actionName, fieldName]) =>
        `${actionName}<T extends ${getModelArgName(
          name,
          actionName as DMMF.ModelAction,
        )}>(args: Subset<T, ${getModelArgName(name, actionName as DMMF.ModelAction)}>): PromiseLike<${
          actionName === 'findMany' ? 'Array<' : ''
        }${name}GetPayload<Extract${getModelArgName(name, DMMF.ModelAction.findMany)}Select<T>>>${
          actionName === 'findMany' ? '>' : ''
        }`,
    )
    .join('\n'),
  tab,
)}
}
function ${name}Delegate(dmmf: DMMFClass, fetcher: PrismaFetcher): ${name}Delegate {
  const ${name} = <T extends ${name}Args>(args: Subset<T, ${name}Args>) => new ${name}Client<Array<${name}GetPayload<Extract${getModelArgName(
      name,
      DMMF.ModelAction.findMany,
    )}Select<T>>>>(dmmf, fetcher, 'query', '${mapping.findMany}', '${mapping.findMany}', args, [])
${indent(
  actions
    .map(
      ([actionName, fieldName]) =>
        `${name}.${actionName} = <T extends ${getModelArgName(
          name,
          actionName as DMMF.ModelAction,
        )}>(args: Subset<T, ${getModelArgName(name, actionName as DMMF.ModelAction)}>) => new ${name}Client<${
          actionName === 'findMany' ? 'Array<' : ''
        }${name}GetPayload<Extract${getModelArgName(name, DMMF.ModelAction.findMany)}Select<T>>>${
          actionName === 'findMany' ? '>' : ''
        }(dmmf, fetcher, '${getOperation(actionName as DMMF.ModelAction)}', '${fieldName}', '${
          mapping.findMany
        }.${actionName}', args, [])`,
    )
    .join('\n'),
  tab,
)}
  return ${name}
}

class ${name}Client<T> implements PromiseLike<T> {
  constructor(
    private readonly dmmf: DMMFClass,
    private readonly fetcher: PrismaFetcher,
    private readonly queryType: 'query' | 'mutation',
    private readonly rootField: string,
    private readonly clientMethod: string,
    private readonly args: ${name}Args,
    private readonly path: string[]
  ) {}
  readonly [Symbol.toStringTag]: 'PrismaPromise'

${indent(
  fields
    .filter(f => f.kind === 'relation')
    .map(
      f => `private _${f.name}?: ${getFieldTypeName(f)}Client<${getFieldType(f)}>
${f.name}(${new Args(f)}): ${getFieldTypeName(f)}Client<${getFieldType(f)}> {
  const path = [...this.path, '${f.name}']
  const newArgs = args ? deepSet(this.args, path, args) : this.args
  return this._${f.name}
    ? this._${f.name}
    : (this._${f.name} = new ${getFieldTypeName(f)}Client<${getFieldType(
        f,
      )}>(this.dmmf, this.fetcher, this.queryType, this.rootField, this.clientMethod, newArgs, path))
}`,
    )
    .join('\n'),
  2,
)}

  protected get query() {
    const {rootField} = this
    const document = makeDocument({
      dmmf: this.dmmf,
      rootField,
      rootTypeName: this.queryType,
      select: this.args
    })
    document.validate(this.args, false, this.clientMethod)
    return String(document)
  }

  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    return this.fetcher.request<T>(this.query, this.path).then(onfulfilled, onrejected)
  }

  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<T | TResult> {
    return this.fetcher.request<T>(this.query, this.path).catch(onrejected)
  }
}
    `
  }
}

class Args {
  constructor(protected readonly field: DMMF.SchemaField) {}
  toString() {
    const { field } = this
    if (!field.isList && field.args.length > 0) {
      throw new Error(`This must not happen! There are no fields which are non-lists with args.`)
    }
    return `args?: ${getModelArgName(getFieldTypeName(field), DMMF.ModelAction.findMany)}`
  }
}

function getFieldTypeName(field: DMMF.SchemaField) {
  if (typeof field.type === 'string') {
    return field.type
  }

  return field.type.name
}

function getFieldType(field: DMMF.SchemaField) {
  return getFieldTypeName(field) + (field.isList ? '[]' : '')
}

export class QueryDelegate {
  constructor(protected readonly outputType: OutputType) {}
  toString() {
    const name = this.outputType.name
    return `\
interface ${name}Delegate {
  <T extends ${name}Args>(args: Subset<T,${name}Args>): PromiseLike<${name}GetPayload<T>>
}
function ${name}Delegate(dmmf: DMMFClass, fetcher: PrismaFetcher): ${name}Delegate {
  const ${name} = <T extends ${name}Args>(args: ${name}Args) => new ${name}Client<T>(dmmf, fetcher, args, [])
  return ${name}
}

class ${name}Client<T extends ${name}Args, U = ${name}GetPayload<T>> implements PromiseLike<U> {
  constructor(private readonly dmmf: DMMFClass,private readonly fetcher: PrismaFetcher, private readonly args: ${name}Args, private readonly path: []) {}
  readonly [Symbol.toStringTag]: 'Promise'

  protected get query() {
    const rootField = Object.keys(this.args)[0]
    const document = makeDocument({
      dmmf: this.dmmf,
      rootField,
      rootTypeName: 'query',
      select: this.args[rootField]
    })
    // console.dir(document, {depth: 8})
    document.validate(this.args[rootField], true)
    return String(document)
  }

  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = U, TResult2 = never>(
    onfulfilled?: ((value: U) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    return this.fetcher.request<U>(this.query, this.path).then(onfulfilled, onrejected)
  }

  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<U | TResult> {
    return this.fetcher.request<U>(this.query, this.path).catch(onrejected)
  }
}
    `
  }
}

function isQueryAction(action: DMMF.ModelAction, operation: 'query' | 'mutation'): boolean {
  if (!(action in DMMF.ModelAction)) {
    return false
  }
  const result = action === DMMF.ModelAction.findOne || action === DMMF.ModelAction.findMany
  return operation === 'query' ? result : !result
}

export class Field {
  constructor(protected readonly field: BaseField) {}
  toString() {
    const { field } = this
    const fieldName =
      typeof field.type === 'string' ? GraphQLScalarToJSTypeTable[field.type] || field.type : field.type.name
    const optionalStr = field.isRequired ? '' : '?'
    const arrayStr = field.isList ? `[]` : ''
    return `${field.name}${optionalStr}: ${fieldName}${arrayStr}`
  }
}

export class OutputType {
  name: string
  fields: DMMF.SchemaField[]
  constructor(protected readonly type: DMMF.OutputType) {
    this.name = type.name
    this.fields = type.fields
  }
  toString() {
    const { type } = this
    return `
export type ${type.name} = {
${indent(type.fields.map(field => new Field(field).toString()).join('\n'), tab)}
}`
  }
}

export class ArgsType {
  constructor(protected readonly type: DMMF.InputType) {}
  toString() {
    const { type } = this
    const argsWithRequiredSelect = type.args.map(a => (a.name === 'select' ? { ...a, isRequired: true } : a))
    return `
export type ${type.name} = {
${indent(type.args.map(arg => new Field(arg).toString()).join('\n'), tab)}
}

export type ${type.name}WithSelect = {
${indent(argsWithRequiredSelect.map(arg => new Field(arg).toString()).join('\n'), tab)}
}

type Extract${type.name}Select<S extends boolean | ${type.name}> = S extends boolean
  ? S
  : S extends ${type.name}WithSelect
  ? S['select']
  : true
`
  }
}

export class InputType {
  constructor(protected readonly type: DMMF.InputType) {}
  toString() {
    const { type } = this
    return `
export type ${type.name} = {
${indent(type.args.map(arg => new Field(arg).toString()).join('\n'), tab)}
}
`
  }
}
