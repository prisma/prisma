import { GeneratorConfig } from '@prisma/generator-helper'
import 'flat-map-polyfill' // unfortunately needed as it's not properly polyfilled in TypeScript
import indent from 'indent-string'
import { DMMFClass } from '../runtime/dmmf'
import { BaseField, DMMF } from '../runtime/dmmf-types'
import { capitalize, GraphQLScalarToJSTypeTable } from '../runtime/utils/common'
import { InternalDatasource } from '../runtime/utils/printDatasources'
import { DatasourceOverwrite } from './extractSqliteSources'
import { serializeDatasources } from './serializeDatasources'
import {
  getDefaultName,
  getFieldArgName,
  getFieldTypeName,
  getIncludeName,
  getModelArgName,
  getPayloadName,
  getRelativePathResolveStatement,
  getScalarsName,
  getSelectName,
  getSelectReturnType,
  getType,
  indentAllButFirstLine,
  // getExtractName,
  isQueryAction,
  Projection,
  renderInitialClientArgs,
} from './utils'

const tab = 2

const commonCode = (runtimePath: string, version?: string) => `import {
  DMMF,
  DMMFClass,
  deepGet,
  deepSet,
  makeDocument,
  Engine,
  debugLib,
  transformDocument,
  chalk,
  printStack,
  mergeBy,
  unpack
} from '${runtimePath}'

/**
 * Query Engine version: ${version || 'latest'}
 */

import path = require('path')
import fs = require('fs')

const debug = debugLib('photon')

/**
 * Utility Types
 */


export type Enumerable<T> = T | Array<T>

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
  constructor(
    private readonly photon: Photon,
    private readonly engine: Engine,
    private readonly debug = false,
    private readonly hooks?: Hooks
  ) {}
  async request<T>(document: any, path: string[] = [], rootField?: string, typeName?: string, isList?: boolean, callsite?: string): Promise<T> {
    const query = String(document)
    debug('Request:')
    debug(query)
    if (this.hooks && this.hooks.beforeRequest) {
      this.hooks.beforeRequest({ query, path, rootField, typeName, document })
    }
    try {
      await this.photon.connect()
      const result = await this.engine.request(query, typeName)
      debug('Response:')
      debug(result)
      return this.unpack(document, result, path, rootField, isList)
    } catch (e) {
      // HACK: This will be removed as soon as the query engine doesn't throw anymore
      if (e.message.includes('Record does not exist') && rootField && rootField.startsWith('findOne')) {
        return null as any
      }
      if (callsite) {
        const { stack } = printStack({
          callsite,
          originalMethod: path.join('.'),
          onUs: e.isPanic
        })
        throw new Error(stack + '\\n\\n' + e.message)
      } else {
        if (e.isPanic) {
          throw e
        } else {
          throw new Error(\`Error in Photon\${path}: \\n\` + e.stack)
        }
      }
    }
  }
  protected unpack(document: any, data: any, path: string[], rootField?: string, isList?: boolean) {
    const getPath: string[] = []
    if (rootField) {
      getPath.push(rootField)
    }
    getPath.push(...path.filter(p => p !== 'select' && p !== 'include'))
    return unpack({ document, path: getPath, data })
  }
}
`

interface TSClientOptions {
  version?: string
  document: DMMF.Document
  runtimePath: string
  browser?: boolean
  datasources: InternalDatasource[]
  generator?: GeneratorConfig
  platforms?: string[]
  sqliteDatasourceOverrides?: DatasourceOverwrite[]
  schemaDir?: string
  outputDir: string
}

export class TSClient {
  protected readonly dmmf: DMMFClass
  protected readonly document: DMMF.Document
  protected readonly runtimePath: string
  protected readonly browser: boolean
  protected readonly outputDir: string
  protected readonly internalDatasources: InternalDatasource[]
  protected readonly generator?: GeneratorConfig
  protected readonly platforms?: string[]
  protected readonly sqliteDatasourceOverrides?: DatasourceOverwrite[]
  protected readonly version?: string
  protected readonly schemaDir?: string
  constructor({
    document,
    runtimePath,
    browser = false,
    datasources,
    generator,
    platforms,
    sqliteDatasourceOverrides,
    schemaDir,
    outputDir,
  }: TSClientOptions) {
    this.document = document
    this.runtimePath = runtimePath
    this.browser = browser
    this.internalDatasources = datasources
    this.generator = generator
    this.platforms = platforms
    this.sqliteDatasourceOverrides = sqliteDatasourceOverrides
    // We make a deep clone here as otherwise we would serialize circular references
    // which we're building up in the DMMFClass
    this.dmmf = new DMMFClass(JSON.parse(JSON.stringify(document)))
    this.schemaDir = schemaDir
    this.outputDir = outputDir
  }
  public toString() {
    return `${commonCode(this.runtimePath, this.version)}

/**
 * Build tool annotations
 * In order to make \`ncc\` and \`node-file-trace\` happy.
**/

${this.platforms ? this.platforms.map(p => `path.join(__dirname, 'runtime/query-engine-${p}');`).join('\n') : ''}

/**
 * Client
**/

${new PhotonClientClass(
  this.dmmf,
  this.internalDatasources,
  this.outputDir,
  this.browser,
  this.generator,
  this.sqliteDatasourceOverrides,
  this.schemaDir,
)}

${/*new Query(this.dmmf, 'query')*/ ''}

/**
 * Enums
 */

// Based on
// https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275

function makeEnum<T extends {[index: string]: U}, U extends string>(x: T) { return x }

${this.dmmf.schema.enums.map(type => new Enum(type)).join('\n\n')}

${Object.values(this.dmmf.modelMap)
  .map(model => new Model(model, this.dmmf))
  .join('\n')}

/**
 * Deep Input Types
 */

${this.dmmf.inputTypes.map(inputType => new InputType(inputType)).join('\n')}

/**
 * Batch Payload for updateMany & deleteMany
 */

export type BatchPayload = {
  count: number
}

/**
 * DMMF
 */

export const dmmf: DMMF.Document = ${JSON.stringify(this.document)}
    `
  }
}

class Datasources {
  constructor(protected readonly internalDatasources: InternalDatasource[]) {}
  public toString() {
    const sources = this.internalDatasources
    return `export type Datasources = {
${indent(sources.map(s => `${s.name}?: string`).join('\n'), 2)}
}`
  }
}

class PhotonClientClass {
  constructor(
    protected readonly dmmf: DMMFClass,
    protected readonly internalDatasources: InternalDatasource[],
    protected readonly outputDir: string,
    protected readonly browser?: boolean,
    protected readonly generator?: GeneratorConfig,
    protected readonly sqliteDatasourceOverrides?: DatasourceOverwrite[],
    protected readonly cwd?: string,
  ) {}
  public toString() {
    const { dmmf } = this

    return `
${new Datasources(this.internalDatasources)}

export type LogLevel = 'INFO' | 'WARN' | 'QUERY' 

export type LogOption = LogLevel | {
  level: LogLevel
  /**
   * @default 'stdout'
   */
  emit?: 'event' | 'stdout'
}

export interface PhotonOptions {
  datasources?: Datasources

  /**
   * @default false
   */
  log?: boolean | LogOption[]

  /**
   * You probably don't want to use this. \`__internal\` is used by internal tooling.
   */
  __internal?: {
    debug?: boolean
    hooks?: Hooks
    engine?: {
      cwd?: string
      binaryPath?: string
    }
  }
}

export type Hooks = {
  beforeRequest?: (options: {query: string, path: string[], rootField?: string, typeName?: string, document: any}) => any
}

export class Photon {
  private fetcher: PhotonFetcher
  private readonly dmmf: DMMFClass
  private readonly engine: Engine
  private connectionPromise?: Promise<any>
  constructor(options: PhotonOptions = {}) {
    const useDebug = options.debug === true ? true : typeof options.debug === 'object' ? Boolean(options.debug.library) : false
    if (useDebug) {
      debugLib.enable('photon')
    }
    const debugEngine = options.debug === true ? true : typeof options.debug === 'object' ? Boolean(options.debug.engine) : false

    // datamodel = datamodel without datasources + printed datasources

    const predefinedDatasources = ${
      this.sqliteDatasourceOverrides
        ? indentAllButFirstLine(serializeDatasources(this.sqliteDatasourceOverrides), 4)
        : '[]'
    }
    const inputDatasources = Object.entries(options.datasources || {}).map(([name, url]) => ({ name, url: url! }))

    const datasources = mergeBy(predefinedDatasources, inputDatasources, (source: any) => source.name)

    const internal = options.__internal || {}
    const engineConfig = internal.engine || {}

    this.engine = new Engine({
      cwd: engineConfig.cwd || ${getRelativePathResolveStatement(this.outputDir, this.cwd)},
      debug: debugEngine,
      datamodelPath: path.resolve(__dirname, 'schema.prisma'),
      prismaPath: engineConfig.binaryPath || undefined,
      datasources,
      generator: ${this.generator ? JSON.stringify(this.generator) : 'undefined'},
    })

    this.dmmf = new DMMFClass(dmmf)
    this.fetcher = new PhotonFetcher(this, this.engine, false, internal.hooks)
  }
  private async connectEngine(publicCall?: boolean) {
    return this.engine.start()
  }
  connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise
    }
    this.connectionPromise = this.connectEngine(true)
    return this.connectionPromise!
  }
  async disconnect() {
    await this.engine.stop()
  }
  // won't be generated for now
  // private _query?: QueryDelegate
  // get query(): QueryDelegate {
  //   return this._query ? this._query: (this._query = QueryDelegate(this.dmmf, this.fetcher))
  // }
${indent(
  dmmf.mappings
    .filter(m => m.findMany)
    .map(
      m => `
get ${m.plural}(): ${m.model}Delegate {
  return ${m.model}Delegate(this.dmmf, this.fetcher)
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
  public toString() {
    const { type } = this
    const { name } = type

    const relationFields = type.fields.filter(f => f.outputType.kind === 'object' && f.name !== 'node')
    const relationFieldConditions =
      relationFields.length === 0
        ? ''
        : `\n${relationFields
            .map(f =>
              indent(
                `: P extends '${f.name}'\n? ${this.wrapArray(
                  f,
                  `${getPayloadName(
                    (f.outputType.type as DMMF.OutputType).name,
                    Projection.select,
                  )}<Extract${getModelArgName(
                    (f.outputType.type as DMMF.OutputType).name,
                    Projection.select,
                    f.outputType.isList ? DMMF.ModelAction.findMany : DMMF.ModelAction.findOne,
                  )}<S[P]>>`,
                )}`,
                8,
              ),
            )
            .join('\n')}`

    return `\
type ${getPayloadName(name, Projection.select)}<S extends ${name}Args> = S extends ${name}Args
  ? {
      [P in keyof S] ${relationFieldConditions}
        : never
    } : never
  `
  }
  protected wrapArray(field: DMMF.SchemaField, str: string) {
    if (field.outputType.isList) {
      return `Array<${str}>`
    }
    return str
  }
}

/**
 * Generates the generic type to calculate a payload based on a include statement
 */
class PayloadType {
  constructor(protected readonly type: OutputType, protected readonly projection: Projection) {}
  public toString() {
    const { type, projection } = this
    const { name } = type

    const relationFields = type.fields.filter(f => f.outputType.kind === 'object')
    const relationFieldConditions =
      relationFields.length === 0
        ? ''
        : `\n${relationFields
            .map(f =>
              indent(
                `: P extends '${f.name}'\n? ${this.wrapArray(
                  f,
                  `${getPayloadName((f.outputType.type as DMMF.OutputType).name, projection)}<Extract${getFieldArgName(
                    f,
                    projection,
                  )}<S[P]>>${!f.outputType.isRequired && !f.outputType.isList ? ' | null' : ''}`,
                )}`,
                8,
              ),
            )
            .join('\n')}`

    const hasScalarFields = type.fields.filter(f => f.outputType.kind !== 'object').length > 0
    const projectionName = projection === Projection.select ? getSelectName(name) : getIncludeName(name)
    return `\
type ${getPayloadName(name, projection)}<S extends boolean | ${projectionName}> = S extends true
  ? ${name}
  : S extends ${projectionName}
  ? {
      [P in CleanupNever<MergeTruthyValues<${projection === Projection.select ? '{}' : getDefaultName(name)}, S>>]${
      hasScalarFields
        ? `: P extends ${getScalarsName(name)}
        ? ${name}[P]`
        : ''
    }${relationFieldConditions}
        : never
    }
   : never`
  }
  protected wrapArray(field: DMMF.SchemaField, str: string) {
    if (field.outputType.isList) {
      return `Array<${str}>`
    }
    return str
  }
}

/**
 * Generates the default selection of a model
 */
class ModelDefault {
  constructor(protected readonly model: DMMF.Model, protected readonly dmmf: DMMFClass) {}
  public toString() {
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
  protected isDefault(field: DMMF.Field) {
    if (field.kind !== 'object') {
      return true
    }

    const model = this.dmmf.datamodel.models.find(m => field.type === m.name)
    return model!.isEmbedded
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
    const argsTypes: Stringifiable[] = []
    for (const action in DMMF.ModelAction) {
      const fieldName = mapping[action]
      if (!fieldName) {
        continue
      }
      const field = this.dmmf.getField(fieldName)
      if (!field) {
        throw new Error(`Oops this must not happen. Could not find field ${fieldName} on either Query or Mutation`)
      }
      if (action === 'updateMany' || action === 'deleteMany') {
        argsTypes.push(new MinimalArgsType(field.args, model, action as DMMF.ModelAction))
      } else {
        argsTypes.push(new ArgsType(field.args, model, action as DMMF.ModelAction))
      }
    }

    argsTypes.push(new ArgsType([], model))

    return argsTypes
  }
  public toString() {
    const { model, outputType } = this

    if (!outputType) {
      return ''
    }

    const scalarFields = model.fields.filter(f => f.kind !== 'object')

    return `
/**
 * Model ${model.name}
 */

export type ${model.name} = {
${indent(
  model.fields
    .filter(f => f.kind !== 'object')
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
    .map(
      f =>
        `${f.name}?: boolean` +
        (f.outputType.kind === 'object' ? ` | ${getFieldArgName(f, Projection.select)}Optional` : ''),
    )
    .join('\n'),
  tab,
)}
}

export type ${getIncludeName(model.name)} = {
${indent(
  outputType.fields
    .filter(f => f.outputType.kind === 'object')
    .map(
      f =>
        `${f.name}?: boolean` +
        (f.outputType.kind === 'object' ? ` | ${getFieldArgName(f, Projection.include)}Optional` : ''),
    )
    .join('\n'),
  tab,
)}
}

${new ModelDefault(model, this.dmmf)}

${new PayloadType(this.outputType!, Projection.select)}

${new PayloadType(this.outputType!, Projection.include)}

${new ModelDelegate(this.outputType!, this.dmmf)}

// Custom InputTypes
${this.argsTypes.map(String).join('\n')}
`
  }
}

export class Query {
  constructor(protected readonly dmmf: DMMFClass, protected readonly operation: 'query' | 'mutation') {}
  public toString() {
    const { dmmf, operation } = this
    const queryName = capitalize(operation)
    const mappings = dmmf.mappings.map(mapping => ({
      name: mapping.model,
      mapping: Object.entries(mapping).filter(([key]) => isQueryAction(key as DMMF.ModelAction, operation)),
    }))
    const queryType = operation === 'query' ? dmmf.queryType : dmmf.mutationType
    const outputType = new OutputType(queryType)
    return `\
/**
 * ${queryName}
 */

export type ${queryName}Args = {
${indent(
  mappings
    .flatMap(({ name, mapping }) =>
      mapping
        .filter(([action, field]) => field)
        .map(([action, field]) => `${field}?: ${getModelArgName(name, Projection.select, action as DMMF.ModelAction)}`),
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
  public toString() {
    const { fields, name } = this.outputType
    const mapping = this.dmmf.mappings.find(m => m.model === name)!
    const actions = Object.entries(mapping).filter(
      ([key, value]) => key !== 'model' && key !== 'plural' && key !== 'aggregate' && value,
    )

    const listConstraint = getModelArgName(name, /*projection*/ undefined, DMMF.ModelAction.findMany)
    // TODO: The following code needs to be split up and is a mess
    return `\
export interface ${name}Delegate {
  <T extends ${listConstraint}>(args?: Subset<T, ${getModelArgName(
      name,
      undefined,
      DMMF.ModelAction.findMany,
    )}>): ${getSelectReturnType({
      name,
      actionName: DMMF.ModelAction.findMany,
      hideCondition: true,
      isField: false,
      renderPromise: true,
      projection: Projection.select,
    })}
${indent(
  actions
    .map(
      ([actionName]: [any, any]) =>
        `${actionName}<T extends ${getModelArgName(name, /*projection*/ undefined, actionName)}>(
  args${actionName === DMMF.ModelAction.findMany ? '?' : ''}: Subset<T, ${getModelArgName(name, undefined, actionName)}>
): ${getSelectReturnType({ name, actionName, projection: Projection.select })}`,
    )
    .join('\n'),
  tab,
)}
  count(): Promise<number>
}
function ${name}Delegate(dmmf: DMMFClass, fetcher: PhotonFetcher): ${name}Delegate {
  const ${name} = <T extends ${listConstraint}>(args: Subset<T, ${getModelArgName(
      name,
      undefined,
      DMMF.ModelAction.findMany,
    )}>) => new ${name}Client<${getSelectReturnType({
      name,
      actionName: DMMF.ModelAction.findMany,
      projection: Projection.select,
    })}>(dmmf, fetcher, 'query', '${mapping.findMany}', '${mapping.plural}', args, [])
${indent(
  actions
    .map(([actionName, fieldName]: [any, any]) =>
      actionName === 'deleteMany' || actionName === 'updateMany'
        ? `${name}.${actionName} = (args: ${getModelArgName(
            name,
            undefined,
            actionName,
          )}) => new ${name}Client<Promise<BatchPayload>>(${renderInitialClientArgs(actionName, fieldName, mapping)})`
        : `${name}.${actionName} = <T extends ${getModelArgName(
            name,
            /*projection*/ undefined,
            actionName as DMMF.ModelAction,
          )}>(args: Subset<T, ${getModelArgName(name, Projection.select, actionName as DMMF.ModelAction)}>) => ${
            actionName !== 'findMany' ? `args.select ? ` : ''
          }new ${name}Client<${getSelectReturnType({
            name,
            actionName,
            hideCondition: false,
            isField: true,
            projection: Projection.select,
          })}>(${renderInitialClientArgs(actionName, fieldName, mapping)})${
            actionName !== 'findMany'
              ? ` : new ${name}Client<${(getType(name, actionName === 'findMany'),
                actionName === 'findOne')}>(${renderInitialClientArgs(actionName, fieldName, mapping)})`
              : ''
          }`,
    )
    .join('\n'),
  tab,
)}
  ${name}.count = () => new ${name}Client<number>(dmmf, fetcher, 'query', '${mapping.aggregate!}', '${
      mapping.plural
    }.count', {}, ['count'])
  return ${name} as any // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}

export class ${name}Client<T> implements Promise<T> {
  private _callsite: any
  private _requestPromise?: Promise<any>
  constructor(
    private readonly _dmmf: DMMFClass,
    private readonly _fetcher: PhotonFetcher,
    private readonly _queryType: 'query' | 'mutation',
    private readonly _rootField: string,
    private readonly _clientMethod: string,
    private readonly _args: any,
    private readonly _path: string[],
    private _isList = false
  ) {
    // @ts-ignore
    if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
      const error = new Error()
      if (error && error.stack) {
        const stack = error.stack
        this._callsite = stack
      }
    }
  }
  readonly [Symbol.toStringTag]: 'PhotonPromise'

${indent(
  fields
    .filter(f => f.outputType.kind === 'object')
    .map(f => {
      const fieldTypeName = (f.outputType.type as DMMF.OutputType).name
      return `
${f.name}<T extends ${getFieldArgName(f)} = {}>(args?: Subset<T, ${getFieldArgName(f)}>): ${getSelectReturnType({
        name: fieldTypeName,
        actionName: f.outputType.isList ? DMMF.ModelAction.findMany : DMMF.ModelAction.findOne,
        hideCondition: false,
        isField: true,
        renderPromise: true,
        fieldName: f.name,
        projection: Projection.select,
      })} {
  const prefix = this._path.includes('select') ? 'select' : this._path.includes('include') ? 'include' : 'select'
  const path = [...this._path, prefix, '${f.name}']
  const newArgs = deepSet(this._args, path, args || true)
  this._isList = ${f.outputType.isList}
  return new ${getFieldTypeName(f)}Client<${getSelectReturnType({
        name: fieldTypeName,
        actionName: f.outputType.isList ? DMMF.ModelAction.findMany : DMMF.ModelAction.findOne,
        hideCondition: false,
        isField: true,
        renderPromise: true,
        projection: Projection.select,
      })}>(this._dmmf, this._fetcher, this._queryType, this._rootField, this._clientMethod, newArgs, path, this._isList) as any
}`
    })
    .join('\n'),
  2,
)}

  private get _document() {
    const { _rootField: rootField } = this
    const document = makeDocument({
      dmmf: this._dmmf,
      rootField,
      rootTypeName: this._queryType,
      select: this._args
    })
    try {
      document.validate(this._args, false, this._clientMethod)
    } catch (e) {
      const x: any = e
      if (x.render) {
        if (this._callsite) {
          e.message = x.render(this._callsite)
        }
      }
      throw e
    }
    return transformDocument(document)
  }

  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    if (!this._requestPromise){
      this._requestPromise = this._fetcher.request<T>(this._document, this._path, this._rootField, '${name}', this._isList, this._callsite)
    }
    return this._requestPromise!.then(onfulfilled, onrejected)
  }

  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null,
  ): Promise<T | TResult> {
    if (!this._requestPromise) {
      this._requestPromise = this._fetcher.request<T>(this._document, this._path, this._rootField, '${name}', this._isList, this._callsite)
    }
    return this._requestPromise!.catch(onrejected)
  }

  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): Promise<T> {
    if (!this._requestPromise) {
      this._requestPromise = this._fetcher.request<T>(this._document, this._path, this._rootField, '${name}', this._isList, this._callsite)
    }
    return this._requestPromise!.finally(onfinally)
  }
}
    `
  }
}

export class QueryDelegate {
  constructor(protected readonly outputType: OutputType) {}
  public toString() {
    const name = this.outputType.name
    return `\
interface ${name}Delegate {
  <T extends ${name}Args>(args: Subset<T,${name}Args>): Promise<${getPayloadName(name, Projection.select)}<T>>
}
function ${name}Delegate(dmmf: DMMFClass, fetcher: PhotonFetcher): ${name}Delegate {
  const ${name} = <T extends ${name}Args>(args: ${name}Args) => new ${name}Client<T>(dmmf, fetcher, args, [])
  return ${name}
}

class ${name}Client<T extends ${name}Args, U = ${getPayloadName(name, Projection.select)}<T>> implements Promise<U> {
  constructor(private readonly dmmf: DMMFClass, private readonly fetcher: PhotonFetcher, private readonly args: ${name}Args, private readonly path: []) {}

  readonly [Symbol.toStringTag]: 'Promise'

  protected get document() {
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
    return document
  }

  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = U, TResult2 = never>(
    onfulfilled?: ((value: U) => TResult1 | Promise<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    return this.fetcher.request<U>(this.document, this.path, undefined, '${name}').then(onfulfilled, onrejected)
  }

  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null,
  ): Promise<U | TResult> {
    return this.fetcher.request<U>(this.document, this.path, undefined, '${name}').catch(onrejected)
  }
}
    `
  }
}

export class InputField {
  constructor(protected readonly field: DMMF.SchemaArg, protected readonly prefixFilter = false) {}
  public toString() {
    const { field } = this
    let fieldType
    if (Array.isArray(field.inputType)) {
      fieldType = field.inputType
        .flatMap(t =>
          typeof t.type === 'string'
            ? GraphQLScalarToJSTypeTable[t.type] || t.type
            : this.prefixFilter
            ? `Base${t.type.name}`
            : t.type.name,
        )
        .join(' | ')
    }
    const fieldInputType = field.inputType[0]
    const optionalStr = fieldInputType.isRequired ? '' : '?'
    if (fieldInputType.isList) {
      fieldType = `Enumerable<${fieldType}>`
    }
    const nullableStr = !fieldInputType.isRequired ? ' | null' : ''
    return `${field.name}${optionalStr}: ${fieldType}${nullableStr}`
  }
}

export class OutputField {
  constructor(protected readonly field: BaseField) {}
  public toString() {
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
  public name: string
  public fields: DMMF.SchemaField[]
  constructor(protected readonly type: DMMF.OutputType) {
    this.name = type.name
    this.fields = type.fields
  }
  public toString() {
    const { type } = this
    return `
export type ${type.name} = {
${indent(type.fields.map(field => new OutputField({ ...field, ...field.outputType }).toString()).join('\n'), tab)}
}`
  }
}

interface Stringifiable {
  toString(): string
}

export class MinimalArgsType {
  constructor(
    protected readonly args: DMMF.SchemaArg[],
    protected readonly model: DMMF.Model,
    protected readonly action?: DMMF.ModelAction,
  ) {}
  public toString() {
    const { action, args } = this
    const { name } = this.model

    return `
/**
 * ${name} ${action ? action : 'without action'}
 */
export type ${getModelArgName(name, undefined, action)} = {
${indent(args.map(arg => new InputField(arg).toString()).join('\n'), tab)}
}
`
  }
}

export class ArgsType {
  constructor(
    protected readonly args: DMMF.SchemaArg[],
    protected readonly model: DMMF.Model,
    protected readonly action?: DMMF.ModelAction,
  ) {}
  public toString() {
    const { action, args } = this
    const { name } = this.model

    const bothArgsOptional: DMMF.SchemaArg[] = [
      {
        name: 'select',
        inputType: [
          {
            type: getSelectName(name),
            kind: 'object',
            isList: false,
            isRequired: false,
          },
        ],
      },
      {
        name: 'include',
        inputType: [
          {
            type: getIncludeName(name),
            kind: 'object',
            isList: false,
            isRequired: false,
          },
        ],
      },
      ...args,
    ]

    const bothArgsRequired: DMMF.SchemaArg[] = [
      {
        name: 'select',
        inputType: [
          {
            type: getSelectName(name),
            kind: 'object',
            isList: false,
            isRequired: true,
          },
        ],
      },
      {
        name: 'include',
        inputType: [
          {
            type: getIncludeName(name),
            kind: 'object',
            isList: false,
            isRequired: true,
          },
        ],
      },
      ...args,
    ]

    const selectArgsRequired: DMMF.SchemaArg[] = [
      {
        name: 'select',
        inputType: [
          {
            type: getSelectName(name),
            kind: 'object',
            isList: false,
            isRequired: true,
          },
        ],
      },
      ...args,
    ]

    const selectArgsOptional: DMMF.SchemaArg[] = [
      {
        name: 'select',
        inputType: [
          {
            type: getSelectName(name),
            kind: 'object',
            isList: false,
            isRequired: false,
          },
        ],
      },
      ...args,
    ]

    const includeArgsRequired: DMMF.SchemaArg[] = [
      {
        name: 'include',
        inputType: [
          {
            type: getIncludeName(name),
            kind: 'object',
            isList: false,
            isRequired: true,
          },
        ],
      },
      ...args,
    ]

    const includeArgsOptional: DMMF.SchemaArg[] = [
      {
        name: 'include',
        inputType: [
          {
            type: getIncludeName(name),
            kind: 'object',
            isList: false,
            isRequired: false,
          },
        ],
      },
      ...args,
    ]

    return `
/**
 * ${name} ${action ? action : 'without action'}
 */
export type ${getModelArgName(name, undefined, action)} = {
${indent(bothArgsOptional.map(arg => new InputField(arg).toString()).join('\n'), tab)}
}

export type ${getModelArgName(name, undefined, action)}Required = {
${indent(bothArgsRequired.map(arg => new InputField(arg).toString()).join('\n'), tab)}
}

export type ${getModelArgName(name, Projection.select, action)} = {
${indent(selectArgsRequired.map(arg => new InputField(arg).toString()).join('\n'), tab)}
}

export type ${getModelArgName(name, Projection.select, action)}Optional = {
${indent(selectArgsOptional.map(arg => new InputField(arg).toString()).join('\n'), tab)}
}

export type ${getModelArgName(name, Projection.include, action)} = {
${indent(includeArgsRequired.map(arg => new InputField(arg).toString()).join('\n'), tab)}
}

export type ${getModelArgName(name, Projection.include, action)}Optional = {
${indent(includeArgsOptional.map(arg => new InputField(arg).toString()).join('\n'), tab)}
}

export type Extract${getModelArgName(
      name,
      Projection.select,
      action,
    )}<S extends undefined | boolean | ${getModelArgName(
      name,
      Projection.select,
      action,
    )}Optional> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends ${getModelArgName(name, Projection.select, action)}
  ? S['select']
  : true

export type Extract${getModelArgName(
      name,
      Projection.include,
      action,
    )}<S extends undefined | boolean | ${getModelArgName(
      name,
      Projection.include,
      action,
    )}Optional> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends ${getModelArgName(name, Projection.include, action)}
  ? S['include']
  : true

`
  }
}

export class InputType {
  constructor(protected readonly type: DMMF.InputType) {}
  public toString() {
    const { type } = this
    // TO DISCUSS: Should we rely on TypeScript's error messages?
    const body = `{
${indent(type.fields.map(arg => new InputField(arg /*, type.atLeastOne && !type.atMostOne*/)).join('\n'), tab)}
}`
    //     if (type.atLeastOne && !type.atMostOne) {
    //       return `export type Base${type.name} = ${body}
    // export type ${type.name} = AtLeastOne<Base${type.name}>
    //       `
    //     } else if (type.atLeastOne && type.atMostOne) {
    //       return `export type Base${type.name} = ${body}
    // export type ${type.name} = OnlyOne<Base${type.name}>
    //       `
    //     }
    return `
export type ${type.name} = ${body}`
  }
}

export class Enum {
  constructor(protected readonly type: DMMF.Enum) {}
  public toString() {
    const { type } = this

    return `export const ${type.name} = makeEnum({
${indent(type.values.map(v => `${v}: '${v}'`).join(',\n'), tab)}
})

export type ${type.name} = (typeof ${type.name})[keyof typeof ${type.name}]\n`
  }
}
