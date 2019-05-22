import { DMMF, BaseField } from '../runtime/dmmf-types'
import { DMMFClass } from '../runtime/dmmf'
import indent from 'indent-string'
import { GraphQLScalarToJSTypeTable, capitalize } from '../runtime/utils/common'
import 'flat-map-polyfill' // unfortunately needed as it's not properly polyfilled in TypeScript
import {
  getModelArgName,
  getFieldTypeName,
  getPayloadName,
  getFieldArgName,
  getSelectName,
  getDefaultName,
  getScalarsName,
  isQueryAction,
  getSelectReturnType,
  renderInitialClientArgs,
  getType,
} from './utils'

const tab = 2

const commonCode = runtimePath => `import { DMMF, DMMFClass, deepGet, deepSet, makeDocument, Engine, debugLib, transformDocument } from '${runtimePath}'

const debug = debugLib('photon')

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

class PhotonFetcher {
  private url?: string
  constructor(private readonly engine: Engine, private readonly debug = false) {}
  async request<T>(query: string, path: string[] = [], rootField?: string): Promise<T> {
    debug(query)
    const result = await this.engine.request(query)
    debug(result)
    return this.unpack(result, path, rootField)
  }
  protected unpack(result: any, path: string[], rootField?: string) {
    const getPath: string[] = []
    if (rootField) {
      getPath.push(rootField)
    }
    getPath.push(...path.filter(p => p !== 'select'))
    return deepGet(result, getPath)
  }
}
`

export class TSClient {
  protected readonly dmmf: DMMFClass
  constructor(
    protected readonly document: DMMF.Document,
    protected readonly prismaYmlPath: string,
    protected readonly prismaConfig: string,
    protected readonly datamodel: string,
    protected readonly datamodelJson: string,
    protected readonly runtimePath: string,
  ) {
    // We make a deep clone here as otherwise we would serialize circular references
    // which we're building up in the DMMFClass
    this.dmmf = new DMMFClass(JSON.parse(JSON.stringify(document)))
  }
  toString() {
    return `${commonCode(this.runtimePath)}

/**
 * Client
**/

${new PhotonClientClass(this.dmmf, this.prismaYmlPath, this.prismaConfig, this.datamodel, this.datamodelJson)}

${new Query(this.dmmf, 'query')}

/**
 * Enums
 */

${this.dmmf.schema.enums.map(type => new Enum(type)).join('\n\n')}

${Object.values(this.dmmf.modelMap)
  .map(model => new Model(model, this.dmmf))
  .join('\n')}

/**
 * Deep Input Types
 */

${this.dmmf.inputTypes
  .filter(o => !this.dmmf.modelMap[o.name])
  .map(inputType => new InputType(inputType))
  .join('\n')}

/**
 * DMMF
 */

const dmmf: DMMF.Document = ${JSON.stringify(this.document)}
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
class PhotonClientClass {
  constructor(
    protected readonly dmmf: DMMFClass,
    protected readonly prismaYmlPath: string,
    protected readonly prismaConfig: string,
    protected readonly datamodel: string,
    protected readonly datamodelJson: string,
  ) {}
  toString() {
    const { dmmf } = this
    return `
interface PhotonOptions {
  debugEngine?: boolean
  debug?: boolean
}

export class Photon {
  private fetcher: PhotonFetcher
  private readonly dmmf: DMMFClass
  private readonly engine: Engine
  constructor(options: PhotonOptions = {}) {
    const useDebug = options.debug || false
    if (useDebug) {
      debugLib.enable('photon')
    }
    const debugEngine = options.debugEngine || false
    this.engine = new Engine({
      prismaYmlPath: ${JSON.stringify(this.prismaYmlPath)},
      debug: debugEngine,
      datamodel: ${JSON.stringify(this.datamodel)},
      prismaConfig: ${JSON.stringify(this.prismaConfig)},
      datamodelJson: ${JSON.stringify(this.datamodelJson)}
    })
    this.dmmf = new DMMFClass(dmmf)
    this.fetcher = new PhotonFetcher(this.engine)
  }
  async connect() {
    // TODO: Provide autoConnect: false option so that this is even needed
    await this.engine.startPromise
  }
  async close() {
    this.engine.stop()
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
  this.connect()
  return this._${m.findMany}? this._${m.findMany} : (this._${m.findMany} = ${m.model}Delegate(this.dmmf, this.fetcher))
}`,
    )
    .join('\n'),
  2,
)}
}
`
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

    const hasScalarFields = type.fields.filter(f => f.kind !== 'relation').length > 0
    return `\
type ${getPayloadName(name)}<S extends boolean | ${getSelectName(name)}> = S extends true
  ? ${name}
  : S extends ${getSelectName(name)}
  ? {
      [P in CleanupNever<MergeTruthyValues<${getDefaultName(name)}, S>>]${
      hasScalarFields
        ? `: P extends ${getScalarsName(name)}
        ? ${name}[P]`
        : ''
    }${relationFieldConditions}
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
    if (field.kind !== 'relation') {
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
  protected outputType?: OutputType
  protected mapping: DMMF.Mapping
  constructor(protected readonly model: DMMF.Model, protected readonly dmmf: DMMFClass) {
    const outputType = dmmf.outputTypeMap[model.name]
    this.outputType = new OutputType(outputType)
    this.mapping = dmmf.mappings.find(m => m.model === model.name)!
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
              type: [getSelectName(model.name)],
              isList: false,
              isRequired: false,
              isScalar: false,
              isEnum: false,
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
            type: [getSelectName(model.name)],
            isList: false,
            isRequired: false,
            isScalar: false,
            isEnum: false,
          },
        ],
      }),
    )
    // }

    return argsTypes
  }
  toString() {
    const { model, outputType } = this

    if (!outputType) {
      return ''
    }

    const scalarFields = model.fields.filter(f => f.kind !== 'relation')

    return `
/**
 * Model ${model.name}
 */

export type ${model.name} = {
${indent(
  model.fields
    .filter(f => f.kind !== 'relation')
    .map(field => new OutputField(field).toString())
    .join('\n'),
  tab,
)}
}

${
  scalarFields.length > 0
    ? `export type ${getScalarsName(model.name)} = ${
        scalarFields.length > 0 ? scalarFields.map(f => `'${f.name}'`).join(' | ') : ``
      }
  `
    : ''
}

export type ${getSelectName(model.name)} = {
${indent(
  outputType.fields
    .map(f => `${f.name}?: boolean` + (f.kind === 'relation' ? ` | ${getFieldArgName(f)}` : ''))
    .join('\n'),
  tab,
)}
}

${new ModelDefault(model, this.dmmf)}

${new PayloadType(this.outputType!)}

${new ModelDelegate(this.outputType!, this.dmmf)}

// InputTypes
${this.argsTypes.map(String).join('\n')}
`
  }
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
      mapping
        .filter(([action, field]) => field)
        .map(([action, field]) => `${field}?: ${getModelArgName(name, action as DMMF.ModelAction)}`),
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
    const mapping = this.dmmf.mappings.find(m => m.model === name)!
    const actions = Object.entries(mapping).filter(([key, value]) => key !== 'model' && value)

    // TODO: The following code needs to be split up and is a mess
    return `\
export interface ${name}Delegate {
  <T extends ${getModelArgName(name, DMMF.ModelAction.findMany)}>(args: Subset<T, ${getModelArgName(
      name,
      DMMF.ModelAction.findMany,
    )}>): ${getSelectReturnType({
      name,
      actionName: DMMF.ModelAction.findMany,
      hideCondition: true,
      isField: false,
      renderPromise: true,
    })}
${indent(
  actions
    .map(
      ([actionName]: [any, any]) =>
        `${actionName}<T extends ${getModelArgName(name, actionName)}>(
  args: Subset<T, ${getModelArgName(name, actionName)}>
): ${getSelectReturnType({ name, actionName })}`,
    )
    .join('\n'),
  tab,
)}
}
function ${name}Delegate(dmmf: DMMFClass, fetcher: PhotonFetcher): ${name}Delegate {
  const ${name} = <T extends ${getModelArgName(name, DMMF.ModelAction.findMany)}>(args: Subset<T, ${getModelArgName(
      name,
      DMMF.ModelAction.findMany,
    )}>) => new ${name}Client<${getSelectReturnType({
      name,
      actionName: DMMF.ModelAction.findMany,
    })}>(dmmf, fetcher, 'query', '${mapping.findMany}', '${mapping.findMany}', args, [])
${indent(
  actions
    .map(
      ([actionName, fieldName]: [any, any]) =>
        `${name}.${actionName} = <T extends ${getModelArgName(
          name,
          actionName as DMMF.ModelAction,
        )}>(args: Subset<T, ${getModelArgName(name, actionName as DMMF.ModelAction)}>) => ${
          actionName !== 'findMany' ? `args.select ? ` : ''
        }new ${name}Client<${getSelectReturnType({
          name,
          actionName,
          hideCondition: false,
          isField: true,
        })}>(${renderInitialClientArgs(actionName, fieldName, mapping)})${
          actionName !== 'findMany'
            ? ` : new ${name}Client<${getType(name, actionName === 'findMany')}>(${renderInitialClientArgs(
                actionName,
                fieldName,
                mapping,
              )})`
            : ''
        }`,
    )
    .join('\n'),
  tab,
)}
  return ${name} as any // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}

class ${name}Client<T> implements PromiseLike<T> {
  constructor(
    private readonly dmmf: DMMFClass,
    private readonly fetcher: PhotonFetcher,
    private readonly queryType: 'query' | 'mutation',
    private readonly rootField: string,
    private readonly clientMethod: string,
    private readonly args: ${name}Args,
    private readonly path: string[]
  ) {}
  readonly [Symbol.toStringTag]: 'PhotonPromise'

${indent(
  fields
    .filter(f => f.kind === 'relation')
    .map(f => {
      const fieldTypeName = (f.type as DMMF.OutputType).name
      return `private _${f.name}?: ${getFieldTypeName(f)}Client<any>
${f.name}<T extends ${getFieldArgName(f)} = {}>(args?: Subset<T, ${getFieldArgName(f)}>): ${getSelectReturnType({
        name: fieldTypeName,
        actionName: f.isList ? DMMF.ModelAction.findMany : DMMF.ModelAction.findOne,
        hideCondition: true,
        isField: true,
        renderPromise: true,
      })} {
  const path = [...this.path, 'select', '${f.name}']
  const newArgs = deepSet(this.args, path, args || true)
  return this._${f.name}
    ? this._${f.name}
    : (this._${f.name} = new ${getFieldTypeName(f)}Client<${getSelectReturnType({
        name: fieldTypeName,
        actionName: f.isList ? DMMF.ModelAction.findMany : DMMF.ModelAction.findOne,
        hideCondition: false,
        isField: true,
        renderPromise: true,
      })}>(this.dmmf, this.fetcher, this.queryType, this.rootField, this.clientMethod, newArgs, path)) as any
}`
    })
    .join('\n'),
  2,
)}

  protected get query() {
    const { rootField } = this
    const document = makeDocument({
      dmmf: this.dmmf,
      rootField,
      rootTypeName: this.queryType,
      select: this.args
    })
    document.validate(this.args, false, this.clientMethod)
    debug(String(document))
    const newDocument = transformDocument(document)
    return String(newDocument)
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
    return this.fetcher.request<T>(this.query, this.path, this.rootField).then(onfulfilled, onrejected)
  }

  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<T | TResult> {
    return this.fetcher.request<T>(this.query, this.path, this.rootField).catch(onrejected)
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

export class QueryDelegate {
  constructor(protected readonly outputType: OutputType) {}
  toString() {
    const name = this.outputType.name
    return `\
interface ${name}Delegate {
  <T extends ${name}Args>(args: Subset<T,${name}Args>): PromiseLike<${name}GetPayload<T>>
}
function ${name}Delegate(dmmf: DMMFClass, fetcher: PhotonFetcher): ${name}Delegate {
  const ${name} = <T extends ${name}Args>(args: ${name}Args) => new ${name}Client<T>(dmmf, fetcher, args, [])
  return ${name}
}

class ${name}Client<T extends ${name}Args, U = ${name}GetPayload<T>> implements PromiseLike<U> {
  constructor(private readonly dmmf: DMMFClass, private readonly fetcher: PhotonFetcher, private readonly args: ${name}Args, private readonly path: []) {}
  readonly [Symbol.toStringTag]: 'Promise'

  protected get query() {
    const rootField = Object.keys(this.args)[0]
    const document = makeDocument({
      dmmf: this.dmmf,
      rootField,
      rootTypeName: 'query',
      // @ts-ignore
      select: this.args[rootField]
    })
    // @ts-ignore
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

export class InputField {
  constructor(protected readonly field: BaseField) {}
  toString() {
    const { field } = this
    // ENUMTODO
    let fieldType
    if (Array.isArray(field.type)) {
      fieldType = field.type.map(t => (typeof t === 'string' ? GraphQLScalarToJSTypeTable[t] || t : t.name)).join(' | ')
    }
    const optionalStr = field.isRequired ? '' : '?'
    const arrayStr = field.isList ? `[]` : ''
    return `${field.name}${optionalStr}: ${fieldType}${arrayStr}`
  }
}

export class OutputField {
  constructor(protected readonly field: BaseField) {}
  toString() {
    const { field } = this
    // ENUMTODO
    let fieldType =
      typeof field.type === 'string' ? GraphQLScalarToJSTypeTable[field.type] || field.type : field.type[0].name
    if (Array.isArray(fieldType)) {
      fieldType = fieldType[0]
    }
    const arrayStr = field.isList ? `[]` : ''
    const nullableStr = !field.isRequired && !field.isList ? ' | null' : ''
    return `${field.name}: ${fieldType}${arrayStr}${nullableStr}`
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
${indent(type.fields.map(field => new OutputField(field).toString()).join('\n'), tab)}
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
${indent(type.args.map(arg => new InputField(arg).toString()).join('\n'), tab)}
}

export type ${type.name}WithSelect = {
${indent(argsWithRequiredSelect.map(arg => new InputField(arg).toString()).join('\n'), tab)}
}

type Extract${type.name}Select<S extends undefined | boolean | ${type.name}> = S extends undefined
  ? false
  : S extends boolean
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
${indent(type.args.map(arg => new InputField(arg).toString()).join('\n'), tab)}
}
`
  }
}

export class Enum {
  constructor(protected readonly type: DMMF.Enum) {}
  toString() {
    const { type } = this
    return `export enum ${type.name} {
${indent(type.values.map(v => `${v} = '${v}'`).join(',\n'), tab)}
}`
  }
}
