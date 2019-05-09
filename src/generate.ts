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
import { deepGet } from './utils/deep-set';
import { makeDocument } from './query';
import { Subset } from './generated';

/**
 * Utility Types
 */

/**
 * Intersection
 * @desc From \`T\` pick properties that exist in \`U\`
 */
export type Intersection<T extends object, U extends object> = T extends any
  ? Pick<T, SetIntersection<keyof T, keyof U>>
  : never

/**
 * Diff
 * @desc From \`T\` remove properties that exist in \`U\`
 */
export type Diff<T extends object, U extends object> = Pick<T, SetDifference<keyof T, keyof U>>

/**
 * SetIntersection (same as Extract)
 * @desc Set intersection of given union types \`A\` and \`B\`
 */
export type SetIntersection<A, B> = A extends B ? A : never

/**
 * SetDifference (same as Exclude)
 * @desc Set difference of given union types \`A\` and \`B\`
 */
export type SetDifference<A, B> = A extends B ? never : A

export type MergeTruthyValues<
  T extends object,
  U extends object,
  ValueType = false,
  I = Diff<T, U> & Intersection<U, T> & Diff<U, T>
> = Pick<I, { [Key in keyof I]: I[Key] extends ValueType ? never : Key }[keyof I]>

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

${new PrismaClientClass().toString()}

${new Query(this.dmmf, 'query').toString()}

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

const dmmf: DMMF.Document = ${stringifyObject(this.document)} // TODO: Decide wether to go with JSON.stringify
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
  toString() {
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
  get query() {
    return this._query ? this._query: (this._query= QueryDelegate(this.dmmf, this.fetcher))
  }
}`
  }
}

export class Model {
  protected outputType: OutputType
  protected mapping: DMMF.Mapping
  constructor(protected readonly model: DMMF.Model, protected readonly dmmf: DMMFClass) {
    this.outputType = new OutputType(dmmf.outputTypeMap[model.name])
    this.mapping = dmmf.mappings.find(m => m.model === model.name)
  }
  protected get inputTypes() {
    const { mapping, model } = this
    const inputTypes: InputType[] = []
    for (const action in DMMF.ModelAction) {
      const fieldName = mapping[action]
      if (!fieldName) {
        continue
      }
      const field = this.dmmf.getField(fieldName)
      if (!field) {
        throw new Error(`Oops this must not happen. Could not find field ${fieldName} on either Query or Mutation`)
      }
      inputTypes.push(
        new InputType({
          name: getModelArgName(this.dmmf, model.name, action as DMMF.ModelAction),
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

    if (this.appearsInToOneRelation) {
      inputTypes.push(
        new InputType({
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
    }

    return inputTypes
  }
  /**
   * We only need to generate [MODEL]Args if the [MODEL] is being used in a to one relation
   */
  protected get appearsInToOneRelation(): boolean {
    return this.dmmf.datamodel.models.some(model => model.fields.some(f => f.type === this.model.name))
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

export type ${model.name}Scalars = ${model.fields
      .filter(f => f.kind === 'scalar')
      .map(f => `'${f.name}'`)
      .join(' | ')}

export type ${model.name}Select = {
${indent(
  outputType.fields
    .map(f => `${f.name}?: boolean` + (f.kind === 'relation' ? ` | ${getFieldArgName(f)}` : ''))
    .join('\n'),
  tab,
)}
}

// InputTypes
${this.inputTypes.map(String).join('\n')}
`
  }
}

function getSelectName(modelName: string) {
  return `${modelName}Select`
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
function getModelArgName(dmmf: DMMFClass, modelName: string, action: DMMF.ModelAction): string {
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
    return `\
/**
 * ${name}
 */

export type ${name}Args = {
${indent(
  mappings
    .flatMap(({ name, mapping }) =>
      mapping.map(([action, field]) => `${field}?: ${getModelArgName(dmmf, name, action as DMMF.ModelAction)}`),
    )
    .join('\n'),
  tab,
)}
}

${new Delegate(new OutputType(queryType))}
`
  }
}

export class Delegate {
  constructor(protected readonly outputType: OutputType) {}
  toString() {
    const name = this.outputType.name
    return `\
interface ${name}Delegate {
  (args: ${name}Args): ${name}Client
  // <T extends ${name}Args>(args: Subset<T,${name}Args>): ${name}Client
}
function ${name}Delegate(dmmf: DMMFClass, fetcher: PrismaFetcher): ${name}Delegate {
  const ${name} = (args: ${name}Args) => new ${name}Client(dmmf, fetcher, args, [])
  return ${name}
}

class ${name}Client<T = any[]> implements PromiseLike<T> {
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

export class InputType {
  constructor(protected readonly type: DMMF.InputType) {}
  toString() {
    const { type } = this
    return `
export type ${type.name} = {
${indent(type.args.map(arg => new Field(arg).toString()).join('\n'), tab)}
}`
  }
}
