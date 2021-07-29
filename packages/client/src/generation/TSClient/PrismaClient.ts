import { GeneratorConfig } from '@prisma/generator-helper'
import indent from 'indent-string'
import { DMMFClass } from '../../runtime/dmmf'
import { capitalize, lowerCase } from '../../runtime/utils/common'
import { InternalDatasource } from '../../runtime/utils/printDatasources'
import { DatasourceOverwrite } from './../extractSqliteSources'
import { TAB_SIZE } from './constants'
import { Datasources } from './Datasources'
import { Generatable } from './Generatable'

export class PrismaClientClass implements Generatable {
  constructor(
    protected readonly dmmf: DMMFClass,
    protected readonly internalDatasources: InternalDatasource[],
    protected readonly outputDir: string,
    protected readonly browser?: boolean,
    protected readonly generator?: GeneratorConfig,
    protected readonly sqliteDatasourceOverrides?: DatasourceOverwrite[],
    protected readonly cwd?: string,
  ) {}
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
 * const ${lowerCase(example.plural)} = await prisma.${lowerCase(
      example.model,
    )}.findMany()
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
  GlobalReject = 'rejectOnNotFound' extends keyof T
    ? T['rejectOnNotFound']
    : false
      > {
      /**
       * @private
       */
      private fetcher;
      /**
       * @private
       */
      private readonly dmmf;
      /**
       * @private
       */
      private connectionPromise?;
      /**
       * @private
       */
      private disconnectionPromise?;
      /**
       * @private
       */
      private readonly engineConfig;
      /**
       * @private
       */
      private readonly measurePerformance;

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
  $disconnect(): Promise<any>;

  /**
   * Add a middleware
   */
  $use(cb: Prisma.Middleware): void

  /**
   * Executes a raw query and returns the number of affected rows
   * @example
   * \`\`\`
   * // With parameters use prisma.$executeRaw\`\`, values will be escaped automatically
   * const result = await prisma.$executeRaw\`UPDATE User SET cool = \${true} WHERE id = \${1};\`
   * // Or
   * const result = await prisma.$executeRaw('UPDATE User SET cool = $1 WHERE id = $2 ;', true, 1)
  * \`\`\`
  * 
  * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
  */
  $executeRaw < T = any > (query: string | TemplateStringsArray | Prisma.Sql, ...values: any[]): PrismaPromise<number>;

  /**
   * Performs a raw query and returns the SELECT data
   * @example
   * \`\`\`
   * // With parameters use prisma.$queryRaw\`\`, values will be escaped automatically
   * const result = await prisma.$queryRaw\`SELECT * FROM User WHERE id = \${1} OR email = \${'ema.il'};\`
   * // Or
   * const result = await prisma.$queryRaw('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'ema.il')
  * \`\`\`
  * 
  * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
  */
  $queryRaw < T = any > (query: string | TemplateStringsArray | Prisma.Sql, ...values: any[]): PrismaPromise<T>;

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
  $transaction<P extends PrismaPromise<any>[]>(arg: [...P]): Promise<UnwrapTuple<P>>

    ${indent(
      dmmf.mappings.modelOperations
        .filter((m) => m.findMany)
        .map((m) => {
          const methodName = lowerCase(m.model)
          return `\
/**
 * \`prisma.${methodName}\`: Exposes CRUD operations for the **${
            m.model
          }** model.
  * Example usage:
  * \`\`\`ts
  * // Fetch zero or more ${capitalize(m.plural)}
  * const ${lowerCase(m.plural)} = await prisma.${methodName}.findMany()
  * \`\`\`
  */
get ${methodName}(): Prisma.${m.model}Delegate<GlobalReject>;`
        })
        .join('\n\n'),
      2,
    )}
}`
  }
  public toTS(): string {
    return `${new Datasources(this.internalDatasources).toTS()}

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
    ? GlobalRejectSettings[Action] extends boolean
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
   *  * @example
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
   * Overwrites the datasource url from your prisma.schema file
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

/**
 * These options are being passed in to the middleware as "params"
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
export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined; `
  }
}
