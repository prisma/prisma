import Debug from '@prisma/debug'
import type {
  DatasourceOverwrite,
  Engine,
  EngineConfig,
  EngineEventType,
} from '@prisma/engine-core'
import { LibraryEngine } from '@prisma/engine-core'
import { BinaryEngine } from '@prisma/engine-core'
import { DataProxyEngine } from '@prisma/engine-core'
import type { DataSource, GeneratorConfig } from '@prisma/generator-helper'
import { logger } from '@prisma/sdk'
import { mapPreviewFeatures } from '@prisma/sdk'
import { tryLoadEnvs } from '@prisma/sdk'
import { AsyncResource } from 'async_hooks'
import fs from 'fs'
import path from 'path'
import * as sqlTemplateTag from 'sql-template-tag'
import {
  ClientEngineType,
  getClientEngineType,
} from './utils/getClientEngineType'
import { DMMFClass } from './dmmf'
import { DMMF } from './dmmf-types'
import { getLogLevel } from './getLogLevel'
import { mergeBy } from './mergeBy'
import type {
  EngineMiddleware,
  Namespace,
  QueryMiddleware,
  QueryMiddlewareParams,
} from './MiddlewareHandler'
import { Middlewares } from './MiddlewareHandler'
import { PrismaClientFetcher } from './PrismaClientFetcher'
import { makeDocument, transformDocument } from './query'
import { clientVersion } from './utils/clientVersion'
import { getOutputTypeName, lowerCase } from './utils/common'
import { deepSet } from './utils/deep-set'
import { mssqlPreparedStatement } from './utils/mssqlPreparedStatement'
import { printJsonWithErrors } from './utils/printJsonErrors'
import type {
  InstanceRejectOnNotFound,
  RejectOnNotFound,
} from './utils/rejectOnNotFound'
import { getRejectOnNotFound } from './utils/rejectOnNotFound'
import { serializeRawParameters } from './utils/serializeRawParameters'
import { validatePrismaClientOptions } from './utils/validatePrismaClientOptions'
import { RequestHandler } from './RequestHandler'
import { PrismaClientValidationError } from '.'

const debug = Debug('prisma:client')
const ALTER_RE = /^(\s*alter\s)/i

declare global {
  // eslint-disable-next-line no-var
  var NOT_PROXY: {}
}

global.NOT_PROXY = true

function isReadonlyArray(arg: any): arg is ReadonlyArray<any> {
  return Array.isArray(arg)
}

// TODO also check/disallow for CREATE, DROP
function checkAlter(
  query: string,
  values: sqlTemplateTag.Value[],
  invalidCall:
    | 'prisma.$executeRaw`<SQL>`'
    | 'prisma.$executeRawUnsafe(<SQL>, [...values])'
    | 'prisma.$executeRaw(sql`<SQL>`)',
) {
  if (values.length > 0 && ALTER_RE.exec(query)) {
    // See https://github.com/prisma/prisma-client-js/issues/940 for more info
    throw new Error(`Running ALTER using ${invalidCall} is not supported
Using the example below you can still execute your query with Prisma, but please note that it is vulnerable to SQL injection attacks and requires you to take care of input sanitization.

Example:
  await prisma.$executeRawUnsafe(\`ALTER USER prisma WITH PASSWORD '\${password}'\`)

More Information: https://pris.ly/d/execute-raw
`)
  }
}
export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'

export type Datasource = {
  url?: string
}
export type Datasources = Record<string, Datasource>

export interface PrismaClientOptions {
  /**
   * Will throw an Error if findUnique returns null
   */
  rejectOnNotFound?: InstanceRejectOnNotFound
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
   * log: ['query', 'info', 'warn']
   *
   * // Emit as events
   * log: [
   *  { emit: 'stdout', level: 'query' },
   *  { emit: 'stdout', level: 'info' },
   *  { emit: 'stdout', level: 'warn' }
   * ]
   * \`\`\`
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
   */
  log?: Array<LogLevel | LogDefinition>

  /**
   * @internal
   * You probably don't want to use this. \`__internal\` is used by internal tooling.
   */
  __internal?: {
    debug?: boolean
    hooks?: Hooks
    useUds?: boolean
    engine?: {
      cwd?: string
      binaryPath?: string
      endpoint?: string
      allowTriggerPanic?: boolean
    }
  }
}

export type Unpacker = (data: any) => any

export type HookParams = {
  query: string
  path: string[]
  rootField?: string
  typeName?: string
  document: any
  clientMethod: string
  args: any
}

export type Action = DMMF.ModelAction | 'executeRaw' | 'queryRaw'

export type InternalRequestParams = {
  /**
   * The original client method being called.
   * Even though the rootField / operation can be changed,
   * this method stays as it is, as it's what the user's
   * code looks like
   */
  clientMethod: string // TODO what is this
  callsite?: string // TODO what is this
  headers?: Record<string, string> // TODO what is this
  transactionId?: number // TODO what is this
  unpacker?: Unpacker // TODO what is this
} & QueryMiddlewareParams

// only used by the .use() hooks
export type AllHookArgs = {
  params: HookParams
  fetch: (params: HookParams) => Promise<any>
}

// TODO: drop hooks 💣
export type Hooks = {
  beforeRequest?: (options: HookParams) => any
}

/* Types for Logging */
export type LogLevel = 'info' | 'query' | 'warn' | 'error'
export type LogDefinition = {
  level: LogLevel
  emit: 'stdout' | 'event'
}

export type GetLogType<T extends LogLevel | LogDefinition> =
  T extends LogDefinition
    ? T['emit'] extends 'event'
      ? T['level']
      : never
    : never
export type GetEvents<T extends Array<LogLevel | LogDefinition>> =
  | GetLogType<T[0]>
  | GetLogType<T[1]>
  | GetLogType<T[2]>

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

export interface GetPrismaClientOptions {
  document: DMMF.Document
  generator?: GeneratorConfig
  sqliteDatasourceOverrides?: DatasourceOverwrite[]
  relativeEnvPaths: {
    rootEnvPath?: string | null
    schemaEnvPath?: string | null
  }
  relativePath: string
  dirname: string
  clientVersion?: string
  engineVersion?: string
  datasourceNames: string[]
  activeProvider: string

  /**
   * The contents of the schema encoded into a string
   */
  inlineSchema?: string
}

const actionOperationMap = {
  findUnique: 'query',
  findFirst: 'query',
  findMany: 'query',
  count: 'query',
  create: 'mutation',
  createMany: 'mutation',
  update: 'mutation',
  updateMany: 'mutation',
  upsert: 'mutation',
  delete: 'mutation',
  deleteMany: 'mutation',
  executeRaw: 'mutation',
  queryRaw: 'mutation',
  aggregate: 'query',
  groupBy: 'query',
}

const aggregateKeys = {
  _avg: true,
  _count: true,
  _sum: true,
  _min: true,
  _max: true,
}

// TODO improve all these types, need a common place to share them between type
// gen and this. This will be relevant relevant for type gen tech debt refactor
export interface Client {
  _dmmf: DMMFClass
  _engine: Engine
  _fetcher: PrismaClientFetcher
  _connectionPromise?: Promise<any>
  _disconnectionPromise?: Promise<any>
  _engineConfig: EngineConfig
  _clientVersion: string
  _errorFormat: ErrorFormat
  $use<T>(
    arg0: Namespace | QueryMiddleware<T>,
    arg1?: QueryMiddleware | EngineMiddleware<T>,
  )
  $on(eventType: EngineEventType, callback: (event: any) => void)
  $connect()
  $disconnect()
  _runDisconnect()
  $executeRaw(
    query: TemplateStringsArray | sqlTemplateTag.Sql,
    ...values: any[]
  )
  $queryRaw(query: TemplateStringsArray | sqlTemplateTag.Sql, ...values: any[])
  __internal_triggerPanic(fatal: boolean)
  $transaction(input: any, options?: any)
}

export function getPrismaClient(config: GetPrismaClientOptions) {
  class PrismaClient implements Client {
    _dmmf: DMMFClass
    _engine: Engine
    _fetcher: PrismaClientFetcher
    _connectionPromise?: Promise<any>
    _disconnectionPromise?: Promise<any>
    _engineConfig: EngineConfig
    _clientVersion: string
    _errorFormat: ErrorFormat
    _clientEngineType: ClientEngineType
    private _hooks?: Hooks //
    private _getConfigPromise?: Promise<{
      datasources: DataSource[]
      generators: GeneratorConfig[]
    }>
    private _middlewares: Middlewares = new Middlewares()
    private _previewFeatures: string[]
    private _activeProvider: string
    private _transactionId = 1
    private _rejectOnNotFound?: InstanceRejectOnNotFound

    constructor(optionsArg?: PrismaClientOptions) {
      if (optionsArg) {
        validatePrismaClientOptions(optionsArg, config.datasourceNames)
      }

      this._rejectOnNotFound = optionsArg?.rejectOnNotFound
      this._clientVersion = config.clientVersion ?? clientVersion
      this._activeProvider = config.activeProvider
      this._clientEngineType = getClientEngineType(config.generator!)
      const envPaths = {
        rootEnvPath:
          config.relativeEnvPaths.rootEnvPath &&
          path.resolve(config.dirname, config.relativeEnvPaths.rootEnvPath),
        schemaEnvPath:
          config.relativeEnvPaths.schemaEnvPath &&
          path.resolve(config.dirname, config.relativeEnvPaths.schemaEnvPath),
      }
      const loadedEnv = tryLoadEnvs(envPaths, { conflictCheck: 'none' })
      try {
        const options: PrismaClientOptions = optionsArg ?? {}
        const internal = options.__internal ?? {}

        const useDebug = internal.debug === true
        if (useDebug) {
          Debug.enable('prisma:client')
        }

        if (internal.hooks) {
          this._hooks = internal.hooks
        }

        let cwd = path.resolve(config.dirname, config.relativePath)

        // TODO this logic should not be needed anymore #findSync
        if (globalThis.NOT_PROXY && !fs.existsSync(cwd)) {
          cwd = config.dirname
        }

        const thedatasources = options.datasources || {}
        const inputDatasources = Object.entries(thedatasources)
          /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
          .filter(([_, source]) => {
            return source && source.url
          })
          .map(([name, { url }]: any) => ({
            name,
            url,
          }))

        const datasources = mergeBy(
          [],
          inputDatasources,
          (source: any) => source.name,
        )

        const engineConfig = internal.engine || {}

        if (options.errorFormat) {
          this._errorFormat = options.errorFormat
        } else if (process.env.NODE_ENV === 'production') {
          this._errorFormat = 'minimal'
        } else if (process.env.NO_COLOR) {
          this._errorFormat = 'colorless'
        } else {
          this._errorFormat = 'colorless' // default errorFormat
        }

        this._dmmf = new DMMFClass(config.document)

        this._previewFeatures = config.generator?.previewFeatures ?? []

        this._engineConfig = {
          cwd,
          dirname: config.dirname,
          enableDebugLogs: useDebug,
          allowTriggerPanic: engineConfig.allowTriggerPanic,
          datamodelPath: path.join(config.dirname, 'schema.prisma'),
          prismaPath: engineConfig.binaryPath ?? undefined,
          engineEndpoint: engineConfig.endpoint,
          datasources,
          generator: config.generator,
          showColors: this._errorFormat === 'pretty',
          logLevel: options.log && (getLogLevel(options.log) as any), // TODO
          logQueries:
            options.log &&
            Boolean(
              typeof options.log === 'string'
                ? options.log === 'query'
                : options.log.find((o) =>
                    typeof o === 'string' ? o === 'query' : o.level === 'query',
                  ),
            ),
          env: loadedEnv ? loadedEnv.parsed : {},
          flags: [],
          clientVersion: config.clientVersion,
          previewFeatures: mapPreviewFeatures(this._previewFeatures),
          useUds: internal.useUds,
          activeProvider: config.activeProvider,
          inlineSchema: config.inlineSchema,
        }

        // Append the mongodb experimental flag if the provider is mongodb
        if (config.activeProvider === 'mongodb') {
          const previewFeatures = this._engineConfig.previewFeatures
            ? this._engineConfig.previewFeatures.concat('mongodb')
            : ['mongodb']
          this._engineConfig.previewFeatures = previewFeatures
        }

        debug(`clientVersion: ${config.clientVersion}`)

        this._engine = this.getEngine()
        void this._getActiveProvider()

        // eslint-disable-next-line prettier/prettier
        if (!this._hasPreviewFlag('interactiveTransactions')) {
          this._fetcher = new PrismaClientFetcher(this, false, this._hooks)
        } else {
          this._fetcher = new RequestHandler(this, this._hooks) as any
        }

        if (options.log) {
          for (const log of options.log) {
            const level =
              typeof log === 'string'
                ? log
                : log.emit === 'stdout'
                ? log.level
                : null
            if (level) {
              this.$on(level, (event) => {
                logger.log(
                  `${logger.tags[level] ?? ''}`,
                  event.message || event.query,
                )
              })
            }
          }
        }

        this._bootstrapClient()
      } catch (e) {
        e.clientVersion = this._clientVersion
        throw e
      }
    }
    get [Symbol.toStringTag]() {
      return 'PrismaClient'
    }
    private getEngine(): Engine {
      if (this._clientEngineType === ClientEngineType.Library) {
        return globalThis.NOT_PROXY && new LibraryEngine(this._engineConfig)
      } else if (this._clientEngineType === ClientEngineType.DataProxy) {
        return new DataProxyEngine(this._engineConfig)
      } else {
        return globalThis.NOT_PROXY && new BinaryEngine(this._engineConfig)
      }
    }

    /**
     * Hook a middleware into the client
     * @param middleware to hook
     */
    $use<T>(middleware: QueryMiddleware<T>)
    $use<T>(namespace: 'all', cb: QueryMiddleware<T>) // TODO: 'all' actually means 'query', to be changed
    $use<T>(namespace: 'engine', cb: EngineMiddleware<T>)
    $use<T>(
      arg0: Namespace | QueryMiddleware<T>,
      arg1?: QueryMiddleware | EngineMiddleware<T>,
    ) {
      // TODO use a mixin and move this into MiddlewareHandler
      if (typeof arg0 === 'function') {
        this._middlewares.query.use(arg0 as QueryMiddleware)
      } else if (arg0 === 'all') {
        this._middlewares.query.use(arg1 as QueryMiddleware)
      } else if (arg0 === 'engine') {
        this._middlewares.engine.use(arg1 as EngineMiddleware)
      } else {
        throw new Error(`Invalid middleware ${arg0}`)
      }
    }

    $on(eventType: EngineEventType, callback: (event: any) => void) {
      if (eventType === 'beforeExit') {
        this._engine.on('beforeExit', callback)
      } else {
        this._engine.on(eventType, (event) => {
          const fields = event.fields
          if (eventType === 'query') {
            return callback({
              timestamp: event.timestamp,
              query: fields?.query ?? event.query,
              params: fields?.params ?? event.params,
              duration: fields?.duration_ms ?? event.duration,
              target: event.target,
            })
          } else {
            // warn, info, or error events
            return callback({
              timestamp: event.timestamp,
              message: fields?.message ?? event.message,
              target: event.target,
            })
          }
        })
      }
    }

    $connect() {
      try {
        return this._engine.start()
      } catch (e) {
        e.clientVersion = this._clientVersion
        throw e
      }
    }
    /**
     * @private
     */
    async _runDisconnect() {
      await this._engine.stop()
      delete this._connectionPromise
      this._engine = this.getEngine()
      delete this._disconnectionPromise
      delete this._getConfigPromise
    }

    /**
     * Disconnect from the database
     */
    $disconnect() {
      try {
        return this._engine.stop()
      } catch (e) {
        e.clientVersion = this._clientVersion
        throw e
      }
    }

    private async _getActiveProvider(): Promise<void> {
      try {
        const configResult = await this._engine.getConfig()
        this._activeProvider = configResult.datasources[0].activeProvider
      } catch (e) {
        // it's ok to silently fail
      }
    }

    /**
     * Executes a raw query. Always returns a number
     */
    private $executeRawInternal(
      runInTransaction: boolean,
      transactionId: number | undefined,
      query: string | TemplateStringsArray | sqlTemplateTag.Sql,
      ...values: sqlTemplateTag.RawValue[]
    ) {
      // TODO Clean up types
      let queryString = ''
      let parameters: any = undefined
      if (typeof query === 'string') {
        // If this was called as prisma.$executeRaw(<SQL>, [...values]), assume it is a pre-prepared SQL statement, and forward it without any changes
        queryString = query
        parameters = {
          values: serializeRawParameters(values || []),
          __prismaRawParamaters__: true,
        }
        checkAlter(
          queryString,
          values,
          'prisma.$executeRawUnsafe(<SQL>, [...values])',
        )
      } else if (isReadonlyArray(query)) {
        // If this was called as prisma.$executeRaw`<SQL>`, try to generate a SQL prepared statement
        switch (this._activeProvider) {
          case 'sqlite':
          case 'mysql': {
            const queryInstance = sqlTemplateTag.sqltag(query, ...values)

            queryString = queryInstance.sql
            parameters = {
              values: serializeRawParameters(queryInstance.values),
              __prismaRawParamaters__: true,
            }
            break
          }

          case 'postgresql': {
            const queryInstance = sqlTemplateTag.sqltag(query, ...values)

            queryString = queryInstance.text
            checkAlter(
              queryString,
              queryInstance.values,
              'prisma.$executeRaw`<SQL>`',
            )
            parameters = {
              values: serializeRawParameters(queryInstance.values),
              __prismaRawParamaters__: true,
            }
            break
          }

          case 'sqlserver': {
            queryString = mssqlPreparedStatement(query)
            parameters = {
              values: serializeRawParameters(values),
              __prismaRawParamaters__: true,
            }
            break
          }
        }
      } else {
        // If this was called as prisma.$executeRaw(sql`<SQL>`), use prepared statements from sql-template-tag
        switch (this._activeProvider) {
          case 'sqlite':
          case 'mysql':
            queryString = query.sql
            break
          case 'postgresql':
            queryString = query.text
            checkAlter(
              queryString,
              query.values,
              'prisma.$executeRaw(sql`<SQL>`)',
            )
            break
          case 'sqlserver':
            queryString = mssqlPreparedStatement(query.strings)
            break
        }
        parameters = {
          values: serializeRawParameters(query.values),
          __prismaRawParamaters__: true,
        }
      }

      if (parameters?.values) {
        debug(`prisma.$executeRaw(${queryString}, ${parameters.values})`)
      } else {
        debug(`prisma.$executeRaw(${queryString})`)
      }

      const args = { query: queryString, parameters }

      debug(`Prisma Client call:`)
      return this._request({
        args,
        clientMethod: 'executeRaw',
        dataPath: [],
        action: 'executeRaw',
        callsite: this._getCallsite(),
        runInTransaction,
        transactionId: transactionId,
      })
    }

    /**
     * Executes a raw query and always returns a number
     */
    private $executeRawRequest(
      query: string | TemplateStringsArray | sqlTemplateTag.Sql,
      ...values: sqlTemplateTag.RawValue[]
    ) {
      const request = (transactionId?: number, runInTransaction?: boolean) => {
        try {
          const promise = this.$executeRawInternal(
            runInTransaction ?? false,
            transactionId,
            query,
            ...values,
          )
          ;(promise as any).isExecuteRaw = true
          return promise
        } catch (e) {
          e.clientVersion = this._clientVersion
          throw e
        }
      }

      return createPrismaPromise(request)
    }

    /**
     * Executes a raw query provided through a safe tag function
     * @see https://github.com/prisma/prisma/issues/7142
     *
     * @param query
     * @param values
     * @returns
     */
    $executeRaw(
      query: TemplateStringsArray | sqlTemplateTag.Sql,
      ...values: any[]
    ) {
      return createPrismaPromise(() => {
        if (
          (query as TemplateStringsArray).raw ||
          (query as sqlTemplateTag.Sql).sql
        ) {
          return this.$executeRawRequest(query, ...values)
        }

        throw new PrismaClientValidationError(`\`$executeRaw\` is a tag function, please use it like the following:
\`\`\`
const result = await prisma.$executeRaw\`UPDATE User SET cool = \${true} WHERE email = \${'user@email.com'};\`
\`\`\`

Or read our docs at https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access#executeraw
`)
      })
    }

    /**
     * Unsafe counterpart of `$executeRaw` that is susceptible to SQL injections
     * @see https://github.com/prisma/prisma/issues/7142
     *
     * @param query
     * @param values
     * @returns
     */
    $executeRawUnsafe(query: string, ...values: sqlTemplateTag.RawValue[]) {
      return this.$executeRawRequest(query, ...values)
    }

    private _getCallsite() {
      if (this._errorFormat !== 'minimal') {
        return new Error().stack
      }
      return undefined
    }

    /**
     * Executes a raw query and returns selected data
     */
    private $queryRawInternal(
      runInTransaction: boolean,
      transactionId: number | undefined,
      query: string | TemplateStringsArray | sqlTemplateTag.Sql,
      ...values: sqlTemplateTag.RawValue[]
    ) {
      let queryString = ''
      let parameters: any = undefined

      if (typeof query === 'string') {
        // If this was called as prisma.$queryRaw(<SQL>, [...values]), assume it is a pre-prepared SQL statement, and forward it without any changes
        queryString = query
        parameters = {
          values: serializeRawParameters(values || []),
          __prismaRawParamaters__: true,
        }
      } else if (isReadonlyArray(query)) {
        // If this was called as prisma.$queryRaw`<SQL>`, try to generate a SQL prepared statement
        // Example: prisma.$queryRaw`SELECT * FROM User WHERE id IN (${Prisma.join(ids)})`
        switch (this._activeProvider) {
          case 'sqlite':
          case 'mysql': {
            const queryInstance = sqlTemplateTag.sqltag(query, ...values)

            queryString = queryInstance.sql
            parameters = {
              values: serializeRawParameters(queryInstance.values),
              __prismaRawParamaters__: true,
            }
            break
          }

          case 'postgresql': {
            const queryInstance = sqlTemplateTag.sqltag(query as any, ...values)

            queryString = queryInstance.text
            parameters = {
              values: serializeRawParameters(queryInstance.values),
              __prismaRawParamaters__: true,
            }
            break
          }

          case 'sqlserver': {
            const queryInstance = sqlTemplateTag.sqltag(query as any, ...values)

            queryString = mssqlPreparedStatement(queryInstance.strings)
            parameters = {
              values: serializeRawParameters(queryInstance.values),
              __prismaRawParamaters__: true,
            }
            break
          }
        }
      } else {
        // If this was called as prisma.$queryRaw(Prisma.sql`<SQL>`), use prepared statements from sql-template-tag
        // Example: prisma.$queryRaw(Prisma.sql`SELECT * FROM User WHERE id IN (${Prisma.join(ids)})`);
        switch (this._activeProvider) {
          case 'sqlite':
          case 'mysql':
            queryString = query.sql
            break
          case 'postgresql':
            queryString = query.text
            break
          case 'sqlserver':
            queryString = mssqlPreparedStatement(query.strings)
            break
        }
        parameters = {
          values: serializeRawParameters(query.values),
          __prismaRawParamaters__: true,
        }
      }

      if (parameters?.values) {
        debug(`prisma.queryRaw(${queryString}, ${parameters.values})`)
      } else {
        debug(`prisma.queryRaw(${queryString})`)
      }

      const args = { query: queryString, parameters }

      debug(`Prisma Client call:`)
      // const doRequest = (runInTransaction = false) => {
      return this._request({
        args,
        clientMethod: 'queryRaw',
        dataPath: [],
        action: 'queryRaw',
        callsite: this._getCallsite(),
        runInTransaction,
        transactionId: transactionId,
      })
    }

    /**
     * Executes a raw query and returns selected data
     */
    private $queryRawRequest(
      query: string | TemplateStringsArray | sqlTemplateTag.Sql,
      ...values: sqlTemplateTag.RawValue[]
    ) {
      const request = (transactionId?: number, runInTransaction?: boolean) => {
        try {
          const promise = this.$queryRawInternal(
            runInTransaction ?? false,
            transactionId,
            query,
            ...values,
          )
          ;(promise as any).isQueryRaw = true
          return promise
        } catch (e) {
          e.clientVersion = this._clientVersion
          throw e
        }
      }

      return createPrismaPromise(request)
    }

    /**
     * Executes a raw query provided through a safe tag function
     * @see https://github.com/prisma/prisma/issues/7142
     *
     * @param query
     * @param values
     * @returns
     */
    $queryRaw(
      query: TemplateStringsArray | sqlTemplateTag.Sql,
      ...values: any[]
    ) {
      return createPrismaPromise(() => {
        if (
          (query as TemplateStringsArray).raw ||
          (query as sqlTemplateTag.Sql).sql
        ) {
          return this.$queryRawRequest(query, ...values)
        }

        throw new PrismaClientValidationError(`\`$queryRaw\` is a tag function, please use it like the following:
\`\`\`
const result = await prisma.$queryRaw\`SELECT * FROM User WHERE id = \${1} OR email = \${'user@email.com'};\`
\`\`\`

Or read our docs at https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access#queryraw
`)
      })
    }

    /**
     * Unsafe counterpart of `$queryRaw` that is susceptible to SQL injections
     * @see https://github.com/prisma/prisma/issues/7142
     *
     * @param query
     * @param values
     * @returns
     */
    $queryRawUnsafe(query: string, ...values: sqlTemplateTag.RawValue[]) {
      return this.$queryRawRequest(query, ...values)
    }

    __internal_triggerPanic(fatal: boolean) {
      if (!this._engineConfig.allowTriggerPanic) {
        throw new Error(`In order to use .__internal_triggerPanic(), please enable it like so:
new PrismaClient({
  __internal: {
    engine: {
      allowTriggerPanic: true
    }
  }
})`)
      }

      // TODO: make a `fatal` boolean instead & let be handled in `engine-core`
      // in `runtimeHeadersToHttpHeaders` maybe add a shared in `Engine`
      const headers: Record<string, string> = fatal
        ? { 'X-DEBUG-FATAL': '1' }
        : { 'X-DEBUG-NON-FATAL': '1' }

      return this._request({
        action: 'queryRaw',
        args: {
          query: 'SELECT 1',
          parameters: undefined,
        },
        clientMethod: 'queryRaw',
        dataPath: [],
        runInTransaction: false,
        headers,
        callsite: this._getCallsite(),
      })
    }

    /**
     * @deprecated
     */
    private ___getTransactionId() {
      return this._transactionId++
    }

    /**
     * @deprecated
     */
    private async $___transactionInternal(promises: Array<any>): Promise<any> {
      for (const p of promises) {
        if (!p) {
          throw new Error(
            `All elements of the array need to be Prisma Client promises. Hint: Please make sure you are not awaiting the Prisma client calls you intended to pass in the $transaction function.`,
          )
        }
        if (
          (!p.requestTransaction ||
            typeof p.requestTransaction !== 'function') &&
          !p?.isQueryRaw &&
          !p?.isExecuteRaw
        ) {
          throw new Error(
            `All elements of the array need to be Prisma Client promises. Hint: Please make sure you are not awaiting the Prisma client calls you intended to pass in the $transaction function.`,
          )
        }
      }

      const transactionId = this.___getTransactionId()

      const requests = await Promise.all(
        promises.map((p) => {
          if (p.requestTransaction) {
            return p.requestTransaction(transactionId)
          } else {
          }
          return p
        }),
      )

      return Promise.all(
        requests.map((r) => {
          if (Object.prototype.toString.call(r) === '[object Promise]') {
            return r
          }
          if (r && typeof r === 'function') {
            return r()
          }
          return r
        }),
      )
    }

    /**
     * @deprecated
     */
    private async $___transaction(promises: Array<any>): Promise<any> {
      try {
        return this.$___transactionInternal(promises)
      } catch (e) {
        e.clientVersion = this._clientVersion
        throw e
      }
    }

    /**
     * Execute queries within a transaction
     * @param input a callback or a query list
     * @param options to set timeouts
     * @returns
     */
    $transaction(input: any, options?: any) {
      // eslint-disable-next-line prettier/prettier
      if (!this._hasPreviewFlag('interactiveTransactions')) {
        return this.$___transaction(input)
      }

      try {
        return this._transaction(input, options)
      } catch (e) {
        e.clientVersion = this._clientVersion

        throw e
      }
    }

    /**
     * Decide upon which transaction logic to use
     * @param input
     * @param options
     * @returns
     */
    private async _transaction(input: any, options?: any) {
      if (typeof input === 'function') {
        return this._transactionWithCallback(input, options)
      }

      return this._transactionWithRequests(input, options)
    }

    /**
     * Perform a long-running transaction
     * @param callback
     * @param options
     * @returns
     */
    private async _transactionWithCallback(
      callback: (client: Client) => Promise<unknown>,
      options?: { maxWait: number; timeout: number },
    ) {
      // we ask the query engine to open a transaction
      const info = await this._engine.transaction('start', options)

      let result: unknown
      try {
        // execute user logic with a proxied the client
        result = await callback(transactionProxy(this, info.id))

        // it went well, then we commit the transaction
        await this._engine.transaction('commit', info)
      } catch (e) {
        // it went bad, then we rollback the transaction
        await this._engine.transaction('rollback', info)

        throw e
      }

      return result
    }

    /**
     * Execute a batch of requests in a transaction
     * @param requests
     * @param options
     */
    private async _transactionWithRequests(
      requests: Array<Promise<unknown>>,
      options?: { maxWait: number; timeout: number },
    ) {
      return this._transactionWithCallback(async (prisma) => {
        const transactionId: string = prisma[TX_ID] // some proxy magic

        const _requests = requests.map((request) => {
          return new Promise((resolve, reject) => {
            // each request has already been called with `prisma.<call>`
            // so we inject `transactionId` by intercepting that promise
            ;(request as any).then(resolve, reject, transactionId)
          })
        })

        return Promise.all(_requests) // get results from `BatchLoader`
      }, options)
    }

    /**
     * Runs the middlewares over params before executing a request
     * @param internalParams
     * @param middlewareIndex
     * @returns
     */
    private _request(internalParams: InternalRequestParams): Promise<any> {
      try {
        // make sure that we don't leak extra properties to users
        const params: QueryMiddlewareParams = {
          args: internalParams.args,
          dataPath: internalParams.dataPath,
          runInTransaction: internalParams.runInTransaction,
          action: internalParams.action,
          model: internalParams.model,
        }

        let index = -1
        // prepare recursive fn that will pipe params through middlewares
        const consumer = (changedParams: QueryMiddlewareParams) => {
          // if this `next` was called and there's some more middlewares
          const nextMiddleware = this._middlewares.query.get(++index)

          if (nextMiddleware) {
            // we pass the modfied params down to the next one, & repeat
            return nextMiddleware(changedParams, consumer)
          }

          const changedInternalParams = { ...internalParams, ...params }

          // TODO remove this once LRT is the default transaction mode
          if (index > 0 && !this._hasPreviewFlag('interactiveTransactions')) {
            delete changedInternalParams['transactionId']
          }

          // no middleware? then we just proceed with request execution
          return this._executeRequest(changedInternalParams)
        }

        if (globalThis.NOT_PROXY) {
          // async scope https://github.com/prisma/prisma/issues/3148
          const resource = new AsyncResource('prisma-client-request')
          return resource.runInAsyncScope(() => consumer(params))
        }

        return consumer(params)
      } catch (e) {
        e.clientVersion = this._clientVersion

        throw e
      }
    }

    private _executeRequest({
      args,
      clientMethod,
      dataPath,
      callsite,
      runInTransaction,
      action,
      model,
      headers,
      transactionId,
      unpacker,
    }: InternalRequestParams) {
      if (action !== 'executeRaw' && action !== 'queryRaw' && !model) {
        throw new Error(`Model missing for action ${action}`)
      }

      if ((action === 'executeRaw' || action === 'queryRaw') && model) {
        throw new Error(
          `executeRaw and queryRaw can't be executed on a model basis. The model ${model} has been provided`,
        )
      }
      let rootField: string | undefined
      const operation = actionOperationMap[action]

      if (action === 'executeRaw' || action === 'queryRaw') {
        rootField = action
      }

      // TODO: Replace with lookup map for speedup
      let mapping
      if (model) {
        mapping = this._dmmf.mappingsMap[model]
        if (!mapping) {
          throw new Error(`Could not find mapping for model ${model}`)
        }

        rootField = mapping[action]
      }

      if (operation !== 'query' && operation !== 'mutation') {
        throw new Error(`Invalid operation ${operation} for action ${action}`)
      }

      const field = this._dmmf.rootFieldMap[rootField!]

      if (!field) {
        throw new Error(
          `Could not find rootField ${rootField} for action ${action} for model ${model} on rootType ${operation}`,
        )
      }

      const { isList } = field.outputType
      const typeName = getOutputTypeName(field.outputType.type)

      const rejectOnNotFound: RejectOnNotFound = getRejectOnNotFound(
        action,
        typeName,
        args,
        this._rejectOnNotFound,
      )
      let document = makeDocument({
        dmmf: this._dmmf,
        rootField: rootField!,
        rootTypeName: operation,
        select: args,
      })

      document.validate(args, false, clientMethod, this._errorFormat, callsite)

      document = transformDocument(document)

      // as printJsonWithErrors takes a bit of compute
      // we only want to do it, if debug is enabled for 'prisma-client'
      if (Debug.enabled('prisma:client')) {
        const query = String(document)
        debug(`Prisma Client call:`)
        debug(
          `prisma.${clientMethod}(${printJsonWithErrors({
            ast: args,
            keyPaths: [],
            valuePaths: [],
            missingItems: [],
          })})`,
        )
        debug(`Generated request:`)
        debug(query + '\n')
      }

      return this._fetcher.request({
        document,
        clientMethod,
        typeName,
        dataPath,
        rejectOnNotFound,
        isList,
        rootField: rootField!,
        callsite,
        showColors: this._errorFormat === 'pretty',
        args,
        engineHook: this._middlewares.engine.get(0),
        runInTransaction,
        headers,
        transactionId,
        unpacker,
      })
    }

    private _bootstrapClient() {
      const modelClientBuilders = this._dmmf.mappings.modelOperations.reduce(
        (modelClientBuilders, modelMapping) => {
          const lowerCaseModel = lowerCase(modelMapping.model)
          const model = this._dmmf.modelMap[modelMapping.model]

          if (!model) {
            throw new Error(
              `Invalid mapping ${modelMapping.model}, can't find model`,
            )
          }

          // creates a builder for `prisma...<function>` in the runtime so that
          // all models will get their own sub-"client" for query execution
          const ModelClientBuilder = ({
            operation,
            actionName,
            args,
            dataPath,
            modelName,
            unpacker,
          }: {
            operation: string
            actionName: Action
            args: any
            dataPath: string[]
            modelName: string
            unpacker?: Unpacker
          }) => {
            let requestPromise: Promise<unknown> | undefined

            // prepare a request with current context & prevent multi-calls we
            // save it into `requestPromise` to allow one request per promise
            const callsite = this._getCallsite()
            const request = (
              transactionId?: number,
              runInTransaction?: boolean,
            ) => {
              requestPromise =
                requestPromise ??
                this._request({
                  args,
                  model: modelName ?? model.name,
                  action: actionName,
                  clientMethod: `${lowerCaseModel}.${actionName}`,
                  dataPath: dataPath,
                  callsite: callsite,
                  runInTransaction: runInTransaction ?? false,
                  transactionId: transactionId,
                  unpacker,
                })

              return requestPromise
            }

            // `modelClient` implements promises to have deferred actions that
            // will be called later on through model delegated functions
            const modelClient = createPrismaPromise(request)

            // add relation fields
            for (const field of model.fields.filter(
              (f) => f.kind === 'object',
            )) {
              modelClient[field.name] = (fieldArgs) => {
                const prefix = dataPath.includes('select')
                  ? 'select'
                  : dataPath.includes('include')
                  ? 'include'
                  : 'select'
                const newDataPath = [...dataPath, prefix, field.name]
                const newArgs = deepSet(args, newDataPath, fieldArgs || true)

                return modelClientBuilders[field.type]({
                  operation,
                  actionName,
                  args: newArgs,
                  dataPath: newDataPath,
                  isList: field.isList,
                  /*
                   * necessary for user.posts() calls -> the original model name needs to be preserved
                   */
                  modelName: modelName || model.name,
                })
              }
            }

            return modelClient
          }

          modelClientBuilders[model.name] = ModelClientBuilder

          return modelClientBuilders
        },
        {},
      )

      for (const mapping of this._dmmf.mappings.modelOperations) {
        const lowerCaseModel = lowerCase(mapping.model)

        const filteredActionsList = {
          model: true,
          plural: true,
          aggregate: true,
          groupBy: true,
        }

        // here we call the `modelClientBuilder` inside of each delegate function
        // once triggered, the function will return the `modelClient` from above
        const delegate: any = Object.keys(mapping).reduce((acc, actionName) => {
          if (!filteredActionsList[actionName]) {
            const operation = getOperation(actionName as any)
            acc[actionName] = (args) =>
              modelClientBuilders[mapping.model]({
                operation,
                actionName,
                dataPath: [],
                args,
              })
          }

          return acc
        }, {})

        delegate.count = (args) => {
          let select
          let unpacker: Unpacker | undefined
          if (args?.select && typeof args?.select === 'object') {
            select = { _count: { select: args.select } }
          } else {
            select = { _count: { select: { _all: true } } }
            unpacker = (data) => {
              data._count = data._count?._all
              return data
            }
          }

          return modelClientBuilders[mapping.model]({
            operation: 'query',
            actionName: `aggregate`,
            args: {
              ...(args ?? {}),
              select,
            },
            dataPath: ['_count'],
            unpacker,
          })
        }

        delegate.aggregate = (args) => {
          /**
           * _avg, _count, _sum, _min, _max need to go into select
           * For speed reasons we can go with "for in "
           */
          let unpacker: Unpacker | undefined = undefined
          const select = Object.entries(args).reduce((acc, [key, value]) => {
            // if it is an aggregate like "_avg", wrap it with "select"
            if (aggregateKeys[key]) {
              if (!acc.select) {
                acc.select = {}
              }
              // `_count` doesn't have a sub-selection
              if (key === '_count' || key === 'count') {
                if (typeof value === 'object' && value) {
                  acc.select[key] = { select: value }
                } else {
                  acc.select[key] = { select: { _all: value } }
                  unpacker = (data) => {
                    if (data._count) {
                      data._count = data._count?._all
                    } else if (data.count) {
                      data.count = data.count?._all
                    }
                    return data
                  }
                }
              } else {
                acc.select[key] = { select: value }
              }
            } else {
              acc[key] = value
            }
            return acc
          }, {} as any)

          return modelClientBuilders[mapping.model]({
            operation: 'query',
            actionName: 'aggregate', // actionName is just cosmetics 💅🏽
            rootField: mapping.aggregate,
            args: select,
            dataPath: [],
            unpacker,
          })
        }

        delegate.groupBy = (args) => {
          let unpacker: Unpacker | undefined = undefined

          /**
           * _avg, _count, _sum, _min, _max need to go into select
           * For speed reasons we can go with "for in "
           */
          const select = Object.entries(args).reduce((acc, [key, value]) => {
            // if it is an aggregate like "_avg", wrap it with "select"
            if (aggregateKeys[key]) {
              if (!acc.select) {
                acc.select = {}
              }

              acc.select[key] = { select: value }
              // otherwise leave it alone
            } else {
              acc[key] = value
            }
            if (key === '_count') {
              if (typeof value === 'object' && value) {
                acc.select[key] = { select: value }
              } else if (typeof value === 'boolean') {
                acc.select[key] = { select: { _all: value } }
                unpacker = (data) => {
                  if (Array.isArray(data)) {
                    data = data.map((row) => {
                      if (
                        row &&
                        typeof row._count === 'object' &&
                        row._count?._all
                      ) {
                        row._count = row._count?._all
                      }
                      return row
                    })
                  }
                  return data
                }
              }
            }
            if (key === 'by' && Array.isArray(value) && value.length > 0) {
              if (!acc.select) {
                acc.select = {}
              }
              for (const by of value) {
                acc.select[by] = true
              }
            }
            return acc
          }, {} as any)

          return modelClientBuilders[mapping.model]({
            operation: 'query',
            actionName: 'groupBy', // actionName is just cosmetics 💅🏽
            rootField: mapping.groupBy,
            args: select,
            dataPath: [],
            unpacker,
          })
        }

        this[lowerCaseModel] = delegate
      }
    }

    /**
     * Shortcut for checking a preview flag
     * @param feature preview flag
     * @returns
     */
    private _hasPreviewFlag(feature: string) {
      return !!this._engineConfig.previewFeatures?.includes(feature)
    }
  }

  return PrismaClient as new (optionsArg?: PrismaClientOptions) => Client
}

const TX_ID = Symbol.for('prisma.client.transaction.id')
const forbidden = ['$connect', '$disconnect', '$on', '$transaction', '$use']

/**
 * Proxy that takes over client promises to pass `transactionId`
 * @param thing to be proxied
 * @param transactionId to be passed down to `_query`
 * @returns
 */
function transactionProxy<T>(thing: T, transactionId: string): T {
  // we only wrap within a proxy if it's possible: if it's an object
  if (typeof thing !== 'object') return thing

  return new Proxy(thing as any as object, {
    get: (target, prop) => {
      // we don't want to allow any calls to our `forbidden` methods
      if (forbidden.includes(prop as string)) return undefined

      // secret accessor to get the `transactionId` in a transaction
      if (prop === TX_ID) return transactionId

      if (typeof target[prop] === 'function') {
        // we override & handle every function call within the proxy
        return (...args: unknown[]) => {
          if (prop === 'then') {
            // this is our promise, we pass it an extra info argument
            // this will call "our" `then` which will call `_request`
            return target[prop](...args, transactionId)
          }

          // if it's not the end promise, continue wrapping as it goes
          return transactionProxy(target[prop](...args), transactionId)
        }
      }

      // probably an object, not the end, continue wrapping as it goes
      return transactionProxy(target[prop], transactionId)
    },
  }) as any as T
}

/**
 * Prisma's `Promise` that is backwards-compatible. All additions on top of the
 * original `Promise` are optional so that it can be backwards-compatible.
 * @see [[createPrismaPromise]]
 */
interface PrismaPromise<A> extends Promise<A> {
  /**
   * Extension of the original `.then` function
   * @param onfulfilled same as regular promises
   * @param onrejected same as regular promises
   * @param transactionId for interactive tx ids
   */
  then<R1 = A, R2 = never>(
    onfulfilled?: (value: A) => R1 | PromiseLike<R1>,
    onrejected?: (error: unknown) => R2 | PromiseLike<R2>,
    transactionId?: number,
  ): Promise<R1 | R2>

  /**
   * Called when executing a batch of regular tx
   * @param id for regular tx ids
   */
  requestTransaction?(id: number): PromiseLike<unknown>
}

/**
 * Creates a [[PrismaPromise]]. It is Prisma's implementation of `Promise` which
 * is essentially a proxy for `Promise`. All the transaction-compatible client
 * methods return one, this allows for pre-preparing queries without executing
 * them until `.then` is called. It's the foundation of Prisma's query batching.
 * @param callback that will be wrapped within our promise implementation
 * @see [[PrismaPromise]]
 * @returns
 */
function createPrismaPromise(
  callback: (
    transactionId?: number,
    runInTransaction?: boolean,
  ) => PrismaPromise<unknown>,
): PrismaPromise<unknown> {
  // we handle exceptions that happen in the scope as `Promise` rejections
  const _callback = (transactionId?: number, runInTransaction?: boolean) => {
    try {
      return callback(transactionId, runInTransaction)
    } catch (error) {
      // and that is because exceptions are not always async
      return Promise.reject(error) as PrismaPromise<unknown>
    }
  }

  return {
    then(onFulfilled, onRejected, transactionId?: number) {
      const promise = _callback(transactionId, false)

      return promise.then(onFulfilled, onRejected, transactionId)
    },
    catch(onRejected) {
      return _callback().catch(onRejected)
    },
    finally(onFinally) {
      return _callback().finally(onFinally)
    },
    requestTransaction(transactionId: number) {
      const promise = _callback(transactionId, true)

      if (promise.requestTransaction) {
        // requestTransaction support for nested promises
        return promise.requestTransaction(transactionId)
      }

      return promise
    },
    [Symbol.toStringTag]: 'PrismaPromise',
  }
}

export function getOperation(action: DMMF.ModelAction): 'query' | 'mutation' {
  if (
    action === DMMF.ModelAction.findMany ||
    action === DMMF.ModelAction.findUnique ||
    action === DMMF.ModelAction.findFirst
  ) {
    return 'query'
  }
  return 'mutation'
}
