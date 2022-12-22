import type { GeneratorConfig } from '@prisma/generator-helper'
import indent from 'indent-string'

import type { DMMFHelper } from '../../runtime/dmmf'
import { capitalize, lowerCase } from '../../runtime/utils/common'
import type { InternalDatasource } from '../../runtime/utils/printDatasources'
import { getModelArgName } from '../utils'
import { runtimeImport } from '../utils/runtimeImport'
import type { DatasourceOverwrite } from './../extractSqliteSources'
import { TAB_SIZE } from './constants'
import { Datasources } from './Datasources'
import type { Generatable } from './Generatable'
import { getModelActions } from './utils/getModelActions'
import { ifExtensions } from './utils/ifExtensions'
import { Patch, Patch3 } from './utils/Patch'

function clientExtensionsResultDefinition(this: PrismaClientClass) {
  const modelNames = Object.keys(this.dmmf.getModelMap())

  const resultGenericParams = (modelName: string) => {
    return `R_${modelName}_Needs extends Record<string, runtime.Types.Extensions.GetSelect<Prisma.${modelName}SelectScalar, ExtArgs['result']['${lowerCase(
      modelName,
    )}']>>`
  }

  const genericParams = [
    ...modelNames.flatMap(resultGenericParams),
    `R extends runtime.Types.Extensions.Args['result'] = {}`,
  ].join(',\n    ')

  const resultParam = (modelName: string) => {
    return `${lowerCase(modelName)}?: {
        [K in keyof R_${modelName}_Needs]: {
          needs: R_${modelName}_Needs[K]
          compute: (data: runtime.Types.GetResult<${modelName}Payload<ExtArgs>, { select: R_${modelName}_Needs[K] }, 'findUniqueOrThrow'>) => unknown
        }
      }`
  }

  const params = `{
      $allModels?: Record<string, {
        compute: (data: unknown) => unknown
      }>
      ${modelNames.map(resultParam).join('\n      ')}
    }`

  return {
    genericParams,
    params,
  }
}

function clientExtensionsModelDefinition(this: PrismaClientClass) {
  const modelNames = Object.keys(this.dmmf.getModelMap())

  const modelParam = (modelName: string) => {
    return `${lowerCase(
      modelName,
    )}?: { [K: symbol]: { ctx: runtime.Types.Extensions.GetModel<Prisma.${modelName}Delegate<false, ExtArgs>, ExtArgs['model']['${lowerCase(
      modelName,
    )}']> } }`
  }

  const params = `{
      $allModels?: Record<string, unknown>
      ${modelNames.map(modelParam).join('\n      ')}
    }`

  return {
    genericParams: `M extends runtime.Types.Extensions.Args['model'] = {}`,
    params,
  }
}

function clientExtensionsQueryDefinition(this: PrismaClientClass) {
  const modelNames = Object.keys(this.dmmf.getModelMap())

  const prismaNamespaceDefinitions = `export type TypeMap<ExtArgs extends runtime.Types.Extensions.Args = runtime.Types.Extensions.DefaultArgs> = {
    model: {${modelNames.reduce((acc, modelName) => {
      const actions = getModelActions(this.dmmf, modelName)

      return `${acc}
    ${modelName}: {${actions.reduce((acc, action) => {
        return `${acc}
      ${action}: {
        args: Prisma.${getModelArgName(modelName, action)}<ExtArgs>,
        result: runtime.Types.Utils.OptionalFlat<${modelName}>
        payload: ${modelName}Payload<ExtArgs>
      }`
      }, '')}
    }`
    }, '')}
  }
}`

  const queryCbDefinition = (modelName: string, operationName: string) => {
    const queryArgs = `runtime.Types.Extensions.ReadonlySelector<Prisma.TypeMap<ExtArgs>['model'][${modelName}][${operationName}]['args']>`
    const queryResult = `Prisma.TypeMap<ExtArgs>['model'][${modelName}][${operationName}]['result']`
    const inputQueryBase = `model: ${modelName}, operation: ${operationName}, args: ${queryArgs}`
    const inputQueryCbBase = `query: (args: ${queryArgs}) => PrismaPromise<${queryResult}>`
    const inputQuery = `{ ${inputQueryBase}, ${inputQueryCbBase} }`

    return `(args: ${inputQuery}) => Promise<${queryResult}>`
  }

  const allOperationsParam = (modelNames: string[], indent: string) => {
    const modelName = modelNames.map((mn) => `'${mn}'`).join(' | ')

    return `{
    ${indent}$allOperations?: ${queryCbDefinition(modelName, `keyof Prisma.TypeMap['model'][${modelName}]`)}
  ${indent}}`
  }

  const modelParam = (propName: string, modelNames: string[]) => {
    const key = modelNames.map((mn) => `'${mn}'`).join(' | ')

    return `${propName}?: {
        [K in keyof Prisma.TypeMap['model'][${key}]]?: ${queryCbDefinition(key, `K`)}
      } & ${allOperationsParam(modelNames, '    ')}`
  }

  const allModelsParam = `{
      ${modelParam('$allModels', modelNames)}
    }`

  const concreteModelParams = `{${modelNames.reduce((acc, modelName) => {
    return `${acc}
      ${modelParam(lowerCase(modelName), [modelName])}`
  }, '')}
    }`

  return {
    genericParams: `Q extends runtime.Types.Extensions.Args['query'] = {}`,
    params: `${allModelsParam} & ${concreteModelParams}`,
    prismaNamespaceDefinitions,
  }
}

function clientExtensionsClientDefinition(this: PrismaClientClass) {
  return {
    genericParams: `C extends runtime.Types.Extensions.Args['client'] = {}`,
    params: `{ [K: symbol]: { ctx: runtime.Types.Extensions.GetClient<PrismaClient<never, never, false, ExtArgs>, ExtArgs['client'], {}> } }`,
  }
}

function clientExtensionsHookDefinition(this: PrismaClientClass, name: '$extends' | 'defineExtension') {
  const result = clientExtensionsResultDefinition.call(this)
  const model = clientExtensionsModelDefinition.call(this)
  const client = clientExtensionsClientDefinition.call(this)
  const query = clientExtensionsQueryDefinition.call(this)
  const lcModelNames = Object.keys(this.dmmf.getModelMap()).map(lowerCase)
  const modelNameUnion = lcModelNames.map((m) => `'${m}'`).join(' | ')
  const genericParams = [result.genericParams, model.genericParams, query.genericParams, client.genericParams]
  const genericVars = genericParams.map((gp) => gp.replace(/ extends .*/g, ','))

  return {
    signature: `${name === 'defineExtension' ? name : `${name}: { extArgs: ExtArgs } & (`}<
    ${genericParams.join(',\n    ')},
    Args extends runtime.Types.Extensions.Args = { result: R, model: M, query: Q, client: C },${
      name === 'defineExtension'
        ? `
    ExtArgs extends runtime.Types.Extensions.Args = runtime.Types.Extensions.DefaultArgs,`
        : ''
    }
  >(extension: ((client: ${
    name === 'defineExtension' ? 'Prisma.DefaultPrismaClient' : 'this'
  }) => { $extends: { extArgs: Args } }) | Prisma.ExtensionArgs<
    ExtArgs,
    ${genericVars.join('\n    ').slice(0, -1)}
  >) ${name === 'defineExtension' ? ':' : '=>'} ${
      name === 'defineExtension'
        ? '(client: any) => PrismaClient<any, any, any, Args>'
        : `runtime.Types.Extensions.GetClient<PrismaClient<T, U, GlobalReject, {
  result: '$allModels' extends keyof Args['result']
  ? { [K in ${modelNameUnion}]: ${Patch3(`Args['result'][K]`, `Args['result']['$allModels']`, `ExtArgs['result'][K]`)} }
  : { [K in (keyof Args['result'] | keyof ExtArgs['result'])]: ${Patch(`Args['result'][K]`, `ExtArgs['result'][K]`)} }
  model: '$allModels' extends keyof Args['model']
  ? { [K in ${modelNameUnion}]: ${Patch3(`Args['model'][K]`, `Args['model']['$allModels']`, `ExtArgs['model'][K]`)} }
  : { [K in (keyof Args['model'] | keyof ExtArgs['model'])]: ${Patch(`Args['model'][K]`, `ExtArgs['model'][K]`)} }
  client: ${Patch(`Args['client']`, `ExtArgs['client']`)}
  query: {}
  }>, Args['client'], ExtArgs['client']>`
    }${name === 'defineExtension' ? '' : ')'};`,
    prismaNamespaceDefinitions: `${query.prismaNamespaceDefinitions}
export type ExtensionArgs<
    ExtArgs extends runtime.Types.Extensions.Args,
    ${genericParams.join(',\n    ')}
> = {
  name?: string,
  result?: R & ${result.params}
  model?: M & ${model.params}
  query?: ${query.params}
  client?: C & ${client.params}
}`,
  }
}

function clientExtensionsDefinitions(this: PrismaClientClass) {
  const define = clientExtensionsHookDefinition.bind(this)('defineExtension')
  const extend = clientExtensionsHookDefinition.bind(this)('$extends')

  return {
    prismaNamespaceDefinitions: ifExtensions(
      `
export function ${define.signature}
${extend.prismaNamespaceDefinitions}`,
      '',
    ),
    prismaClientDefinitions: ifExtensions(
      `  ${extend.signature}
`,
      '',
    ),
  }
}

function batchingTransactionDefinition(this: PrismaClientClass) {
  const args = ['arg: [...P]']
  if (this.dmmf.hasEnumInNamespace('TransactionIsolationLevel', 'prisma')) {
    args.push('options?: { isolationLevel?: Prisma.TransactionIsolationLevel }')
  }
  const argsString = args.join(', ')
  return `
  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * \`\`\`
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * \`\`\`
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends PrismaPromise<any>[]>(${argsString}): Promise<UnwrapTuple<P>>;`
}

function interactiveTransactionDefinition(this: PrismaClientClass) {
  const txOptions = ['maxWait?: number', 'timeout?: number']

  if (this.dmmf.hasEnumInNamespace('TransactionIsolationLevel', 'prisma')) {
    txOptions.push('isolationLevel?: Prisma.TransactionIsolationLevel')
  }

  const optionsType = `{${txOptions.join(', ')}}`
  return `
  $transaction<R>(fn: (prisma: Prisma.TransactionClient) => Promise<R>, options?: ${optionsType}): Promise<R>;`
}

function queryRawDefinition(this: PrismaClientClass) {
  // we do not generate `$queryRaw...` definitions if not supported
  if (!this.dmmf.mappings.otherOperations.write.includes('queryRaw')) {
    return '' // https://github.com/prisma/prisma/issues/8189
  }

  return `
  /**
   * Performs a prepared raw query and returns the \`SELECT\` data.
   * @example
   * \`\`\`
   * const result = await prisma.$queryRaw\`SELECT * FROM User WHERE id = \${1} OR email = \${'user@email.com'};\`
   * \`\`\`
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): PrismaPromise<T>;

  /**
   * Performs a raw query and returns the \`SELECT\` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * \`\`\`
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * \`\`\`
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): PrismaPromise<T>;`
}

function executeRawDefinition(this: PrismaClientClass) {
  // we do not generate `$executeRaw...` definitions if not supported
  if (!this.dmmf.mappings.otherOperations.write.includes('executeRaw')) {
    return '' // https://github.com/prisma/prisma/issues/8189
  }

  return `
  /**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * \`\`\`
   * const result = await prisma.$executeRaw\`UPDATE User SET cool = \${true} WHERE email = \${'user@email.com'};\`
   * \`\`\`
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * \`\`\`
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * \`\`\`
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): PrismaPromise<number>;`
}

function metricDefinition(this: PrismaClientClass) {
  if (!this.generator?.previewFeatures.includes('metrics')) {
    return ''
  }

  return `
  /**
   * Gives access to the client metrics in json or prometheus format.
   * 
   * @example
   * \`\`\`
   * const metrics = await prisma.$metrics.json()
   * // or
   * const metrics = await prisma.$metrics.prometheus()
   * \`\`\`
   */
  readonly $metrics: runtime.${runtimeImport('MetricsClient')};
  `
}

function runCommandRawDefinition(this: PrismaClientClass) {
  // we do not generate `$runCommandRaw` definitions if not supported
  if (!this.dmmf.mappings.otherOperations.write.includes('runCommandRaw')) {
    return '' // https://github.com/prisma/prisma/issues/8189
  }

  return `
  /**
   * Executes a raw MongoDB command and returns the result of it.
   * @example
   * \`\`\`
   * const user = await prisma.$runCommandRaw({
   *   aggregate: 'User',
   *   pipeline: [{ $match: { name: 'Bob' } }, { $project: { email: true, _id: false } }],
   *   explain: false,
   * })
   * \`\`\`
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $runCommandRaw(command: Prisma.InputJsonObject): PrismaPromise<Prisma.JsonObject>;`
}

export class PrismaClientClass implements Generatable {
  protected clientExtensionsDefinitions: {
    prismaNamespaceDefinitions: string
    prismaClientDefinitions: string
  }
  constructor(
    protected readonly dmmf: DMMFHelper,
    protected readonly internalDatasources: InternalDatasource[],
    protected readonly outputDir: string,
    protected readonly browser?: boolean,
    protected readonly generator?: GeneratorConfig,
    protected readonly sqliteDatasourceOverrides?: DatasourceOverwrite[],
    protected readonly cwd?: string,
  ) {
    this.clientExtensionsDefinitions = clientExtensionsDefinitions.bind(this)()
  }
  private get jsDoc(): string {
    const { dmmf } = this

    const example = dmmf.mappings.modelOperations[0]
    return `/**
 * ##  Prisma Client ʲˢ
 * 
 * Type-safe database client for TypeScript & Node.js
 * @example
 * \`\`\`
 * const prisma = new PrismaClient()
 * // Fetch zero or more ${capitalize(example.plural)}
 * const ${lowerCase(example.plural)} = await prisma.${lowerCase(example.model)}.findMany()
 * \`\`\`
 *
 * 
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */`
  }
  public toTSWithoutNamespace(): string {
    const { dmmf } = this
    return `${this.jsDoc}
export class PrismaClient<
  T extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof T ? T['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<T['log']> : never : never,
  GlobalReject extends Prisma.RejectOnNotFound | Prisma.RejectPerOperation | false | undefined = 'rejectOnNotFound' extends keyof T
    ? T['rejectOnNotFound']
    : false${ifExtensions(
      `,
  ExtArgs extends runtime.Types.Extensions.Args = runtime.Types.Extensions.DefaultArgs`,
      '',
    )}
      > {
  ${indent(this.jsDoc, TAB_SIZE)}

  constructor(optionsArg ?: Prisma.Subset<T, Prisma.PrismaClientOptions>);
  $on<V extends (U | 'beforeExit')>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : V extends 'beforeExit' ? () => Promise<void> : Prisma.LogEvent) => void): void;

  /**
   * Connect with the database
   */
  $connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): Promise<void>;

  /**
   * Add a middleware
   */
  $use(cb: Prisma.Middleware): void

${[
  executeRawDefinition.bind(this)(),
  queryRawDefinition.bind(this)(),
  batchingTransactionDefinition.bind(this)(),
  interactiveTransactionDefinition.bind(this)(),
  runCommandRawDefinition.bind(this)(),
  metricDefinition.bind(this)(),
  this.clientExtensionsDefinitions.prismaClientDefinitions,
]
  .join('\n')
  .trim()}

    ${indent(
      dmmf.mappings.modelOperations
        .filter((m) => m.findMany)
        .map((m) => {
          const methodName = lowerCase(m.model)
          return `\
/**
 * \`prisma.${methodName}\`: Exposes CRUD operations for the **${m.model}** model.
  * Example usage:
  * \`\`\`ts
  * // Fetch zero or more ${capitalize(m.plural)}
  * const ${lowerCase(m.plural)} = await prisma.${methodName}.findMany()
  * \`\`\`
  */
get ${methodName}(): ${ifExtensions(
            `runtime.Types.Extensions.GetModel<Prisma.${
              m.model
            }Delegate<GlobalReject, ExtArgs>, ExtArgs['model']['${lowerCase(m.model)}']>`,
            `Prisma.${m.model}Delegate<GlobalReject>`,
          )};`
        })
        .join('\n\n'),
      2,
    )}
}`
  }
  public toTS(): string {
    return `${new Datasources(this.internalDatasources).toTS()}
${this.clientExtensionsDefinitions.prismaNamespaceDefinitions}
export type DefaultPrismaClient = PrismaClient
export type RejectOnNotFound = boolean | ((error: Error) => Error)
export type RejectPerModel = { [P in ModelName]?: RejectOnNotFound }
export type RejectPerOperation =  { [P in "findUnique" | "findFirst"]?: RejectPerModel | RejectOnNotFound } 
type IsReject<T> = T extends true ? True : T extends (err: Error) => Error ? True : False
export type HasReject<
  GlobalRejectSettings extends Prisma.PrismaClientOptions['rejectOnNotFound'],
  LocalRejectSettings,
  Action extends PrismaAction,
  Model extends ModelName
> = LocalRejectSettings extends RejectOnNotFound
  ? IsReject<LocalRejectSettings>
  : GlobalRejectSettings extends RejectPerOperation
  ? Action extends keyof GlobalRejectSettings
    ? GlobalRejectSettings[Action] extends RejectOnNotFound
      ? IsReject<GlobalRejectSettings[Action]>
      : GlobalRejectSettings[Action] extends RejectPerModel
      ? Model extends keyof GlobalRejectSettings[Action]
        ? IsReject<GlobalRejectSettings[Action][Model]>
        : False
      : False
    : False
  : IsReject<GlobalRejectSettings>
export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'

export interface PrismaClientOptions {
  /**
   * Configure findUnique/findFirst to throw an error if the query returns null. 
   * @deprecated since 4.0.0. Use \`findUniqueOrThrow\`/\`findFirstOrThrow\` methods instead.
   * @example
   * \`\`\`
   * // Reject on both findUnique/findFirst
   * rejectOnNotFound: true
   * // Reject only on findFirst with a custom error
   * rejectOnNotFound: { findFirst: (err) => new Error("Custom Error")}
   * // Reject on user.findUnique with a custom error
   * rejectOnNotFound: { findUnique: {User: (err) => new Error("User not found")}}
   * \`\`\`
   */
  rejectOnNotFound?: RejectOnNotFound | RejectPerOperation
  /**
   * Overwrites the datasource url from your schema.prisma file
   */
  datasources?: Datasources

  /**
   * @default "colorless"
   */
  errorFormat?: ErrorFormat

  /**
   * @example
   * \`\`\`
   * // Defaults to stdout
   * log: ['query', 'info', 'warn', 'error']
   * 
   * // Emit as events
   * log: [
   *  { emit: 'stdout', level: 'query' },
   *  { emit: 'stdout', level: 'info' },
   *  { emit: 'stdout', level: 'warn' }
   *  { emit: 'stdout', level: 'error' }
   * ]
   * \`\`\`
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
   */
  log?: Array<LogLevel | LogDefinition>
}

export type Hooks = {
  beforeRequest?: (options: { query: string, path: string[], rootField?: string, typeName?: string, document: any }) => any
}

/* Types for Logging */
export type LogLevel = 'info' | 'query' | 'warn' | 'error'
export type LogDefinition = {
  level: LogLevel
  emit: 'stdout' | 'event'
}

export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
  GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
  : never

export type QueryEvent = {
  timestamp: Date
  query: string
  params: string
  duration: number
  target: string
}

export type LogEvent = {
  timestamp: Date
  message: string
  target: string
}
/* End Types for Logging */


export type PrismaAction =
  | 'findUnique'
  | 'findMany'
  | 'findFirst'
  | 'create'
  | 'createMany'
  | 'update'
  | 'updateMany'
  | 'upsert'
  | 'delete'
  | 'deleteMany'
  | 'executeRaw'
  | 'queryRaw'
  | 'aggregate'
  | 'count'
  | 'runCommandRaw'
  | 'findRaw'

/**
 * These options are being passed into the middleware as "params"
 */
export type MiddlewareParams = {
  model?: ModelName
  action: PrismaAction
  args: any
  dataPath: string[]
  runInTransaction: boolean
}

/**
 * The \`T\` type makes sure, that the \`return proceed\` is not forgotten in the middleware implementation
 */
export type Middleware<T = any> = (
  params: MiddlewareParams,
  next: (params: MiddlewareParams) => Promise<T>,
) => Promise<T>

// tested in getLogLevel.test.ts
export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

/**
 * \`PrismaClient\` proxy available in interactive transactions.
 */
export type TransactionClient = Omit<Prisma.DefaultPrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>
`
  }
}
