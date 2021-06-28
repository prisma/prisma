import Debug from '@prisma/debug'
import {
  DatasourceOverwrite,
  Engine,
  EngineConfig,
  EngineEventType,
} from '@prisma/engine-core/dist/Engine'
import { LibraryEngine } from '@prisma/engine-core/dist/LibraryEngine'
import { BinaryEngine } from '@prisma/engine-core/dist/BinaryEngine'
import {
  DataSource,
  GeneratorConfig,
} from '@prisma/generator-helper/dist/types'
import * as logger from '@prisma/sdk/dist/logger'
import { mapPreviewFeatures } from '@prisma/sdk/dist/utils/mapPreviewFeatures'
import { tryLoadEnvs } from '@prisma/sdk/dist/utils/tryLoadEnvs'
import { AsyncResource } from 'async_hooks'
import fs from 'fs'
import path from 'path'
import * as sqlTemplateTag from 'sql-template-tag'
import { DMMFClass } from './dmmf'
import { DMMF } from './dmmf-types'
import { getLogLevel } from './getLogLevel'
import { mergeBy } from './mergeBy'
import {
  EngineMiddleware,
  Middlewares,
  Namespace,
  QueryMiddleware,
  QueryMiddlewareParams,
} from './MiddlewareHandler'
import { PrismaClientFetcher } from './PrismaClientFetcher'
import { Document, makeDocument, transformDocument } from './query'
import { clientVersion } from './utils/clientVersion'
import { getOutputTypeName, lowerCase } from './utils/common'
import { deepSet } from './utils/deep-set'
import { mssqlPreparedStatement } from './utils/mssqlPreparedStatement'
import { printJsonWithErrors } from './utils/printJsonErrors'
import {
  getRejectOnNotFound,
  InstanceRejectOnNotFound,
  RejectOnNotFound,
} from './utils/rejectOnNotFound'
import { serializeRawParameters } from './utils/serializeRawParameters'
import { validatePrismaClientOptions } from './utils/validatePrismaClientOptions'
const debug = Debug('prisma:client')
const ALTER_RE = /^(\s*alter\s)/i

function isReadonlyArray(arg: any): arg is ReadonlyArray<any> {
  return Array.isArray(arg)
}

function checkAlter(
  query: string,
  values: sqlTemplateTag.Value[],
  invalidCall:
    | 'prisma.$executeRaw`<SQL>`'
    | 'prisma.$executeRaw(<SQL>, [...values])'
    | 'prisma.$executeRaw(sql`<SQL>`)',
) {
  if (values.length > 0 && ALTER_RE.exec(query)) {
    // See https://github.com/prisma/prisma-client-js/issues/940 for more info
    throw new Error(`Running ALTER using ${invalidCall} is not supported
Using the example below you can still execute your query with Prisma, but please note that it is vulnerable to SQL injection attacks and requires you to take care of input sanitization.

Example:
  await prisma.$executeRaw(\`ALTER USER prisma WITH PASSWORD '\${password}'\`)

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
      enableEngineDebugMode?: boolean
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

export type Action =
  | 'findUnique'
  | 'findFirst'
  | 'findMany'
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
  // These will be removed at a later date
  avg: true,
  count: true,
  sum: true,
  min: true,
  max: true,
}

// TODO: We **may** be able to get real types. However, we have both a bootstrapping
// problem here, that we want to return a type that's not yet defined
// and we're typecasting this anyway later
export function getPrismaClient(config: GetPrismaClientOptions): any {
  class NewPrismaClient {
    _dmmf: DMMFClass
    _engine: Engine
    _fetcher: PrismaClientFetcher
    _connectionPromise?: Promise<any>
    _disconnectionPromise?: Promise<any>
    _engineConfig: EngineConfig
    private _errorFormat: ErrorFormat
    private _hooks?: Hooks //
    private _getConfigPromise?: Promise<{
      datasources: DataSource[]
      generators: GeneratorConfig[]
    }>
    private _middlewares: Middlewares = new Middlewares()
    private _clientVersion: string
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

        if (!fs.existsSync(cwd)) {
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
          enableEngineDebugMode: engineConfig.enableEngineDebugMode,
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
        this._fetcher = new PrismaClientFetcher(this, false, this._hooks)

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
    private getEngine() {
      if (
        this._previewFeatures.includes('nApi') ||
        process.env.PRISMA_FORCE_NAPI === 'true'
      ) {
        return new LibraryEngine(this._engineConfig)
      } else {
        return new BinaryEngine(this._engineConfig)
      }
    }

    /**
     * Hook a middleware into the client
     * @param middleware to hook
     */
    $use<T>(middleware: QueryMiddleware<T>)
    $use<T>(namespace: 'all', cb: QueryMiddleware<T>)
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
      transactionId: number | null,
      stringOrTemplateStringsArray:
        | ReadonlyArray<string>
        | string
        | sqlTemplateTag.Sql,
      ...values: sqlTemplateTag.RawValue[]
    ) {
      // TODO Clean up types
      let query = ''
      let parameters: any = undefined
      if (typeof stringOrTemplateStringsArray === 'string') {
        // If this was called as prisma.$executeRaw(<SQL>, [...values]), assume it is a pre-prepared SQL statement, and forward it without any changes
        query = stringOrTemplateStringsArray
        parameters = {
          values: serializeRawParameters(values || []),
          __prismaRawParamaters__: true,
        }
        checkAlter(query, values, 'prisma.$executeRaw(<SQL>, [...values])')
      } else if (isReadonlyArray(stringOrTemplateStringsArray)) {
        // If this was called as prisma.$executeRaw`<SQL>`, try to generate a SQL prepared statement
        switch (this._activeProvider) {
          case 'sqlite':
          case 'mysql': {
            const queryInstance = sqlTemplateTag.sqltag(
              stringOrTemplateStringsArray,
              ...values,
            )

            query = queryInstance.sql
            parameters = {
              values: serializeRawParameters(queryInstance.values),
              __prismaRawParamaters__: true,
            }
            break
          }

          case 'postgresql': {
            const queryInstance = sqlTemplateTag.sqltag(
              stringOrTemplateStringsArray,
              ...values,
            )

            query = queryInstance.text
            checkAlter(query, queryInstance.values, 'prisma.$executeRaw`<SQL>`')
            parameters = {
              values: serializeRawParameters(queryInstance.values),
              __prismaRawParamaters__: true,
            }
            break
          }

          case 'sqlserver': {
            query = mssqlPreparedStatement(stringOrTemplateStringsArray)
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
            query = stringOrTemplateStringsArray.sql
            break
          case 'postgresql':
            query = stringOrTemplateStringsArray.text
            checkAlter(
              query,
              stringOrTemplateStringsArray.values,
              'prisma.$executeRaw(sql`<SQL>`)',
            )
            break
          case 'sqlserver':
            query = mssqlPreparedStatement(stringOrTemplateStringsArray.strings)
            break
        }
        parameters = {
          values: serializeRawParameters(stringOrTemplateStringsArray.values),
          __prismaRawParamaters__: true,
        }
      }

      if (parameters?.values) {
        debug(`prisma.$executeRaw(${query}, ${parameters.values})`)
      } else {
        debug(`prisma.$executeRaw(${query})`)
      }

      const args = { query, parameters }

      debug(`Prisma Client call:`)
      return this._request({
        args,
        clientMethod: 'executeRaw',
        dataPath: [],
        action: 'executeRaw',
        callsite: this._getCallsite(),
        runInTransaction,
        transactionId: transactionId ?? undefined,
      })
    }

    /**
     * Executes a raw query. Always returns a number
     */
    $executeRaw(
      stringOrTemplateStringsArray:
        | ReadonlyArray<string>
        | string
        | sqlTemplateTag.Sql,
      ...values: sqlTemplateTag.RawValue[]
    ) {
      const doRequest = (runInTransaction = false, transactionId?: number) => {
        try {
          const promise = this.$executeRawInternal(
            runInTransaction,
            transactionId ?? null,
            stringOrTemplateStringsArray,
            ...values,
          )
          ;(promise as any).isExecuteRaw = true
          return promise
        } catch (e) {
          e.clientVersion = this._clientVersion
          throw e
        }
      }
      return {
        then(onfulfilled, onrejected) {
          return doRequest().then(onfulfilled, onrejected)
        },
        requestTransaction(transactionId: number) {
          return doRequest(true, transactionId)
        },
        catch(onrejected) {
          return doRequest().catch(onrejected)
        },
        finally(onfinally) {
          return doRequest().finally(onfinally)
        },
      }
    }

    private _getCallsite() {
      if (this._errorFormat !== 'minimal') {
        return new Error().stack
      }
      return undefined
    }

    /**
     * Executes a raw query. Always returns a number
     */
    private $queryRawInternal(
      runInTransaction: boolean,
      transactionId: number | null,
      stringOrTemplateStringsArray:
        | ReadonlyArray<string>
        | TemplateStringsArray
        | sqlTemplateTag.Sql,
      ...values: any[]
    ) {
      let query = ''
      let parameters: any = undefined

      if (typeof stringOrTemplateStringsArray === 'string') {
        // If this was called as prisma.$queryRaw(<SQL>, [...values]), assume it is a pre-prepared SQL statement, and forward it without any changes
        query = stringOrTemplateStringsArray
        parameters = {
          values: serializeRawParameters(values || []),
          __prismaRawParamaters__: true,
        }
      } else if (isReadonlyArray(stringOrTemplateStringsArray)) {
        // If this was called as prisma.$queryRaw`<SQL>`, try to generate a SQL prepared statement
        // Example: prisma.$queryRaw`SELECT * FROM User WHERE id IN (${Prisma.join(ids)})`
        switch (this._activeProvider) {
          case 'sqlite':
          case 'mysql': {
            const queryInstance = sqlTemplateTag.sqltag(
              stringOrTemplateStringsArray,
              ...values,
            )

            query = queryInstance.sql
            parameters = {
              values: serializeRawParameters(queryInstance.values),
              __prismaRawParamaters__: true,
            }
            break
          }

          case 'postgresql': {
            const queryInstance = sqlTemplateTag.sqltag(
              stringOrTemplateStringsArray as any,
              ...values,
            )

            query = queryInstance.text
            parameters = {
              values: serializeRawParameters(queryInstance.values),
              __prismaRawParamaters__: true,
            }
            break
          }

          case 'sqlserver': {
            const queryInstance = sqlTemplateTag.sqltag(
              stringOrTemplateStringsArray as any,
              ...values,
            )

            query = mssqlPreparedStatement(queryInstance.strings)
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
            query = stringOrTemplateStringsArray.sql
            break
          case 'postgresql':
            query = stringOrTemplateStringsArray.text
            break
          case 'sqlserver':
            query = mssqlPreparedStatement(stringOrTemplateStringsArray.strings)
            break
        }
        parameters = {
          values: serializeRawParameters(stringOrTemplateStringsArray.values),
          __prismaRawParamaters__: true,
        }
      }

      if (parameters?.values) {
        debug(`prisma.queryRaw(${query}, ${parameters.values})`)
      } else {
        debug(`prisma.queryRaw(${query})`)
      }

      const args = { query, parameters }

      debug(`Prisma Client call:`)
      // const doRequest = (runInTransaction = false) => {
      return this._request({
        args,
        clientMethod: 'queryRaw',
        dataPath: [],
        action: 'queryRaw',
        callsite: this._getCallsite(),
        runInTransaction,
        transactionId: transactionId ?? undefined,
      })
    }

    /**
     * Executes a raw query. Always returns a number
     */
    $queryRaw(
      stringOrTemplateStringsArray,
      ...values: sqlTemplateTag.RawValue[]
    ) {
      const doRequest = (runInTransaction = false, transactionId?: number) => {
        try {
          const promise = this.$queryRawInternal(
            runInTransaction,
            transactionId ?? null,
            stringOrTemplateStringsArray,
            ...values,
          )
          ;(promise as any).isQueryRaw = true
          return promise
        } catch (e) {
          e.clientVersion = this._clientVersion
          throw e
        }
      }
      return {
        then(onfulfilled, onrejected) {
          return doRequest().then(onfulfilled, onrejected)
        },
        requestTransaction(transactionId: number) {
          return doRequest(true, transactionId)
        },
        catch(onrejected) {
          return doRequest().catch(onrejected)
        },
        finally(onfinally) {
          return doRequest().finally(onfinally)
        },
      }
    }

    __internal_triggerPanic(fatal: boolean) {
      if (!this._engineConfig.enableEngineDebugMode) {
        throw new Error(`In order to use .__internal_triggerPanic(), please enable the debug mode like so:
new PrismaClient({
  __internal: {
    engine: {
      enableEngineDebugMode: true
    }
  }
})`)
      }

      const query = 'SELECT 1'

      const headers: Record<string, string> = fatal
        ? { 'X-DEBUG-FATAL': '1' }
        : { 'X-DEBUG-NON-FATAL': '1' }

      return this._request({
        action: 'queryRaw',
        args: {
          query,
          parameters: undefined,
        },
        clientMethod: 'queryRaw',
        dataPath: [],
        runInTransaction: false,
        headers,
        callsite: this._getCallsite(),
      })
    }

    private getTransactionId() {
      return this._transactionId++
    }

    private async $transactionInternal(promises: Array<any>): Promise<any> {
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

      const transactionId = this.getTransactionId()

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

    async $transaction(promises: Array<any>): Promise<any> {
      try {
        return this.$transactionInternal(promises)
      } catch (e) {
        e.clientVersion = this._clientVersion
        throw e
      }
    }

    /**
     * Runs the middlewares over params before executing a request
     * @param internalParams
     * @param middlewareIndex
     * @returns
     */
    private _request(internalParams: InternalRequestParams): Promise<any> {
      try {
        let index = -1
        // async scope https://github.com/prisma/prisma/issues/3148
        const resource = new AsyncResource('prisma-client-request')
        // make sure that we don't leak extra properties to users
        const params: QueryMiddlewareParams = {
          args: internalParams.args,
          dataPath: internalParams.dataPath,
          runInTransaction: internalParams.runInTransaction,
          action: internalParams.action,
          model: internalParams.model,
        }

        // prepare recursive fn that will pipe params through middlewares
        const consumer = (changedParams: QueryMiddlewareParams) => {
          // if this `next` was called and there's some more middlewares
          const nextMiddleware = this._middlewares.query.get(++index)

          if (nextMiddleware) {
            // we pass the modfied params down to the next one, & repeat
            return nextMiddleware(changedParams, consumer)
          }

          const changedInternalParams = { ...internalParams, ...params }

          // TODO remove this, because transactionId should be passed?
          if (index > 0) delete changedInternalParams['transactionId']

          // no middleware? then we just proceed with request execution
          return this._executeRequest(changedInternalParams)
        }

        return resource.runInAsyncScope(() => consumer(params))
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
      const clients = this._dmmf.mappings.modelOperations.reduce(
        (acc, mapping) => {
          const lowerCaseModel = lowerCase(mapping.model)
          const model = this._dmmf.modelMap[mapping.model]

          if (!model) {
            throw new Error(
              `Invalid mapping ${mapping.model}, can't find model`,
            )
          }

          // TODO: add types
          const prismaClient = ({
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
            dataPath = dataPath ?? []

            const clientMethod = `${lowerCaseModel}.${actionName}`

            let requestPromise: Promise<any>
            const callsite = this._getCallsite()

            const requestModelName = modelName ?? model.name

            const clientImplementation = {
              then: (onfulfilled, onrejected) => {
                if (!requestPromise) {
                  requestPromise = this._request({
                    args,
                    dataPath,
                    action: actionName,
                    model: requestModelName,
                    clientMethod,
                    callsite,
                    runInTransaction: false,
                    unpacker,
                  })
                }

                return requestPromise.then(onfulfilled, onrejected)
              },
              requestTransaction: (transactionId: number) => {
                if (!requestPromise) {
                  requestPromise = this._request({
                    args,
                    dataPath,
                    action: actionName,
                    model: requestModelName,
                    clientMethod,
                    callsite,
                    runInTransaction: true,
                    transactionId,
                    unpacker,
                  })
                }

                return requestPromise
              },
              catch: (onrejected) => {
                if (!requestPromise) {
                  requestPromise = this._request({
                    args,
                    dataPath,
                    action: actionName,
                    model: requestModelName,
                    clientMethod,
                    callsite,
                    runInTransaction: false,
                    unpacker,
                  })
                }

                return requestPromise.catch(onrejected)
              },
              finally: (onfinally) => {
                if (!requestPromise) {
                  requestPromise = this._request({
                    args,
                    dataPath,
                    action: actionName,
                    model: requestModelName,
                    clientMethod,
                    callsite,
                    runInTransaction: false,
                    unpacker,
                  })
                }

                return requestPromise.finally(onfinally)
              },
            }

            // add relation fields
            for (const field of model.fields.filter(
              (f) => f.kind === 'object',
            )) {
              clientImplementation[field.name] = (fieldArgs) => {
                const prefix = dataPath.includes('select')
                  ? 'select'
                  : dataPath.includes('include')
                  ? 'include'
                  : 'select'
                const newDataPath = [...dataPath, prefix, field.name]
                const newArgs = deepSet(args, newDataPath, fieldArgs || true)

                return clients[field.type]({
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

            return clientImplementation
          }

          acc[model.name] = prismaClient

          return acc
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

        const delegate: any = Object.keys(mapping).reduce((acc, actionName) => {
          if (!filteredActionsList[actionName]) {
            const operation = getOperation(actionName as any)
            acc[actionName] = (args) =>
              clients[mapping.model]({
                operation,
                actionName,
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

          return clients[mapping.model]({
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
            // if it is an aggregate like "avg", wrap it with "select"
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

          return clients[mapping.model]({
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
           * avg, count, sum, min, max need to go into select
           * For speed reasons we can go with "for in "
           */
          const select = Object.entries(args).reduce((acc, [key, value]) => {
            // if it is an aggregate like "avg", wrap it with "select"
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

          return clients[mapping.model]({
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
  }

  return NewPrismaClient
}

export type RequestParams = {
  document: Document
  dataPath: string[]
  rootField: string
  typeName: string
  isList: boolean
  clientMethod: string
  callsite?: string
  rejectOnNotFound?: RejectOnNotFound
  runInTransaction?: boolean
  showColors?: boolean
  engineHook?: EngineMiddleware
  args: any
  headers?: Record<string, string>
  transactionId?: number
  unpacker?: Unpacker
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
