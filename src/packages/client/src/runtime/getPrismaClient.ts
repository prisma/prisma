import { DMMFClass } from './dmmf'
import { DMMF } from './dmmf-types'
import path from 'path'
import {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientInitializationError,
  PrismaClientRustPanicError,
} from '.'
import {
  NodeEngine,
  EngineConfig,
  DatasourceOverwrite,
} from '@prisma/engine-core/dist/NodeEngine'
import {
  Document,
  makeDocument,
  unpack,
  transformDocument,
  Args,
} from './query'
import Debug from '@prisma/debug'
const debug = Debug('prisma-client')
import fs from 'fs'
import chalk from 'chalk'
import * as sqlTemplateTag from 'sql-template-tag'
import {
  GeneratorConfig,
  DataSource,
} from '@prisma/generator-helper/dist/types'
import { getLogLevel } from './getLogLevel'
import { mergeBy } from './mergeBy'
import { lowerCase, getOutputTypeName } from './utils/common'
import { deepSet } from './utils/deep-set'
import { Dataloader } from './Dataloader'
import { printStack } from './utils/printStack'
import stripAnsi from 'strip-ansi'
import { printJsonWithErrors } from './utils/printJsonErrors'
import { ConnectorType } from './utils/printDatasources'
import { mapPreviewFeatures } from '@prisma/sdk/dist/utils/mapPreviewFeatures'
import { serializeRawParameters } from './utils/serializeRawParameters'
import { AsyncResource } from 'async_hooks'
import { clientVersion } from './utils/clientVersion'
import { mssqlPreparedStatement } from './utils/mssqlPreparedStatement'
import { tryLoadEnvs } from '@prisma/sdk'
import { validatePrismaClientOptions } from './utils/validatePrismaClientOptions'

export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'

export type Datasource = {
  url?: string
}
export type Datasources = Record<string, Datasource>

export interface PrismaClientOptions {
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
    engine?: {
      cwd?: string
      binaryPath?: string
      endpoint?: string
      enableEngineDebugMode?: boolean
    }
  }
}

export type HookParams = {
  query: string
  path: string[]
  rootField?: string
  typeName?: string
  document: any
  clientMethod: string
  args: any
}

/**
 * These options are being passed in to the middleware as "params"
 */
export type MiddlewareParams = {
  model?: string
  action: Action
  args: any
  dataPath: string[]
  runInTransaction: boolean
}

/**
 * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
 */
export type Middleware<T = any> = (
  params: MiddlewareParams,
  next: (params: MiddlewareParams) => Promise<T>,
) => Promise<T>

export interface InternalRequestParams extends MiddlewareParams {
  /**
   * The original client method being called.
   * Even though the rootField / operation can be changed,
   * this method stays as it is, as it's what the user's
   * code looks like
   */
  clientMethod: string
  callsite?: string
  headers?: Record<string, string>
}

export type HookPoint = 'all' | 'engine'

export type EngineMiddlewareParams = {
  document: Document
  runInTransaction?: boolean
}

// only used by the .use() hooks
export type AllHookArgs = {
  params: HookParams
  fetch: (params: HookParams) => Promise<any>
}
/**
 * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
 */
export type EngineMiddleware<T = any> = (
  params: EngineMiddlewareParams,
  next: (params: EngineMiddlewareParams) => Promise<T>,
) => Promise<T>

export type Hooks = {
  beforeRequest?: (options: HookParams) => any
}

/* Types for Logging */
export type LogLevel = 'info' | 'query' | 'warn' | 'error'
export type LogDefinition = {
  level: LogLevel
  emit: 'stdout' | 'event'
}

export type GetLogType<
  T extends LogLevel | LogDefinition
  > = T extends LogDefinition
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
    rootEnvPath?: string | null,
    schemaEnvPath?: string | null
  }
  relativePath: string
  dirname: string
  clientVersion?: string
  engineVersion?: string
  datasourceNames: string[]
}

export type Action =
  | 'findOne'
  | 'findUnique'
  | 'findFirst'
  | 'findMany'
  | 'create'
  | 'update'
  | 'updateMany'
  | 'upsert'
  | 'delete'
  | 'deleteMany'
  | 'executeRaw'
  | 'queryRaw'
  | 'aggregate'

const actionOperationMap = {
  findOne: 'query',
  findUnique: 'query',
  findFirst: 'query',
  findMany: 'query',
  count: 'query',
  create: 'mutation',
  update: 'mutation',
  updateMany: 'mutation',
  upsert: 'mutation',
  delete: 'mutation',
  deleteMany: 'mutation',
  executeRaw: 'mutation',
  queryRaw: 'mutation',
  aggregate: 'query',
}

const aggregateKeys = {
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
    _engine: NodeEngine
    _fetcher: PrismaClientFetcher
    _connectionPromise?: Promise<any>
    _disconnectionPromise?: Promise<any>
    _engineConfig: EngineConfig
    private _errorFormat: ErrorFormat
    private _hooks?: Hooks
    private _getConfigPromise?: Promise<{
      datasources: DataSource[]
      generators: GeneratorConfig[]
    }>
    private _middlewares: Middleware[] = []
    private _engineMiddlewares: EngineMiddleware[] = []
    private _clientVersion: string
    constructor(optionsArg?: PrismaClientOptions) {
      if (optionsArg) {
        validatePrismaClientOptions(optionsArg, config.datasourceNames)
      }

      this._clientVersion = config.clientVersion ?? clientVersion
      const envPaths = {
        rootEnvPath: config.relativeEnvPaths.rootEnvPath && path.resolve(config.dirname, config.relativeEnvPaths.rootEnvPath),
        schemaEnvPath: config.relativeEnvPaths.schemaEnvPath && path.resolve(config.dirname, config.relativeEnvPaths.schemaEnvPath)
      }
      const loadedEnv = tryLoadEnvs(envPaths, { conflictCheck: 'none' })
      try {
        const options: PrismaClientOptions = optionsArg ?? {}
        const internal = options.__internal ?? {}

        const useDebug = internal.debug === true
        if (useDebug) {
          Debug.enable('prisma-client')
        }

        if (internal.hooks) {
          this._hooks = internal.hooks
        }

        let predefinedDatasources = config.sqliteDatasourceOverrides ?? []
        predefinedDatasources = predefinedDatasources.map((d) => ({
          name: d.name,
          url: 'file:' + path.resolve(config.dirname, d.url),
        }))

        const inputDatasources = Object.entries(options.datasources || {})
          .filter(([_, source]) => {
            return source && source.url
          })
          .map(([name, { url }]: any) => ({ name, url }))

        const datasources = mergeBy(
          predefinedDatasources,
          inputDatasources,
          (source) => source.name,
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

        let cwd = path.resolve(config.dirname, config.relativePath)

        if (!fs.existsSync(cwd)) {
          cwd = config.dirname
        }

        const previewFeatures = config.generator?.previewFeatures ?? []

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
          enableExperimental: mapPreviewFeatures(previewFeatures),
        }

        debug({ clientVersion: config.clientVersion })

        this._engine = new NodeEngine(this._engineConfig)
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
                const colorMap = {
                  query: 'blue',
                  info: 'cyan',
                  warn: 'yellow',
                  error: 'red',
                }
                console.error(
                  chalk[colorMap[level]](`prisma:${level}`.padEnd(13)) +
                  (event.message || event.query),
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

    $use(cb: Middleware)
    $use(namespace: 'all', cb: Middleware)
    $use(namespace: 'engine', cb: EngineMiddleware)
    $use(
      namespace: HookPoint | Middleware,
      cb?: Middleware | EngineMiddleware,
    ) {
      if (typeof namespace === 'function') {
        this._middlewares.push(namespace)
      } else if (typeof namespace === 'string') {
        if (namespace === 'all') {
          this._middlewares.push(cb! as Middleware)
        } else if (namespace === 'engine') {
          this._engineMiddlewares.push(cb! as EngineMiddleware)
        } else {
          throw new Error(`Unknown middleware hook ${namespace}`)
        }
      } else {
        throw new Error(`Invalid middleware ${namespace}`)
      }
    }

    $on(eventType: any, callback: (event: any) => void) {
      if (eventType === 'beforeExit') {
        this._engine.on('beforeExit', callback)
      } else {
        this._engine.on(eventType, (event) => {
          const fields = event.fields
          if (eventType === 'query') {
            return callback({
              timestamp: event.timestamp,
              query: fields.query,
              params: fields.params,
              duration: fields.duration_ms,
              target: event.target,
            })
          } else {
            // warn, info, or error events
            return callback({
              timestamp: event.timestamp,
              message: fields.message,
              target: event.target,
            })
          }
        })
      }
    }

    async $connect() {
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
      this._engine = new NodeEngine(this._engineConfig)
      delete this._disconnectionPromise
      delete this._getConfigPromise
    }

    /**
     * Disconnect from the database
     */
    async $disconnect() {
      try {
        return this._engine.stop()
      } catch (e) {
        e.clientVersion = this._clientVersion
        throw e
      }
    }

    private async _getActiveProvider(): Promise<ConnectorType> {
      const configResult = await this._engine.getConfig()
      return configResult.datasources[0].activeProvider!
    }


    /**
     * Executes a raw query. Always returns a number
     */
    private async $executeRawInternal(stringOrTemplateStringsArray: ReadonlyArray<string> | string | sqlTemplateTag.Sql, ...values: sqlTemplateTag.RawValue[]) {
      // TODO Clean up types
      let query = ''
      let parameters: any = undefined

      const activeProvider = await this._getActiveProvider()

      if (typeof stringOrTemplateStringsArray === 'string') {
        // If this was called as prisma.$executeRaw(<SQL>, [...values]), assume it is a pre-prepared SQL statement, and forward it without any changes
        query = stringOrTemplateStringsArray
        parameters = {
          values: serializeRawParameters(values || []),
          __prismaRawParamaters__: true,
        }
      } else if (Array.isArray(stringOrTemplateStringsArray)) {
        // If this was called as prisma.$executeRaw`<SQL>`, try to generate a SQL prepared statement
        switch (activeProvider) {
          case 'sqlite':
          case 'mysql': {
            let queryInstance = sqlTemplateTag.sqltag(
              stringOrTemplateStringsArray as any,
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
            let queryInstance = sqlTemplateTag.sqltag(
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
            query = mssqlPreparedStatement(stringOrTemplateStringsArray as any)
            parameters = {
              values: serializeRawParameters(values),
              __prismaRawParamaters__: true,
            }
            break
          }
        }
      } else {
        // If this was called as prisma.raw(sql`<SQL>`), use prepared statements from sql-template-tag
        switch (activeProvider) {
          case 'sqlite':
          case 'mysql':
            query = (stringOrTemplateStringsArray as sqlTemplateTag.Sql).sql
            break
          case 'postgresql':
            query = (stringOrTemplateStringsArray as sqlTemplateTag.Sql).text
            break
          case 'sqlserver':
            query = mssqlPreparedStatement(
              (stringOrTemplateStringsArray as sqlTemplateTag.Sql).strings,
            )
            break
        }
        parameters = {
          values: serializeRawParameters(
            (stringOrTemplateStringsArray as sqlTemplateTag.Sql).values,
          ),
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
        runInTransaction: false,
      })
    }

    /**
     * Executes a raw query. Always returns a number
     */
    $executeRaw(stringOrTemplateStringsArray: ReadonlyArray<string> | string | sqlTemplateTag.Sql, ...values: sqlTemplateTag.RawValue[]) {
      try {
        const promise = this.$executeRawInternal(stringOrTemplateStringsArray, ...values)
          ; (promise as any).isExecuteRaw = true
        return promise
      } catch (e) {
        e.clientVersion = this._clientVersion
        throw e
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
    private async $queryRawInternal(
      stringOrTemplateStringsArray:
        | string
        | TemplateStringsArray
        | sqlTemplateTag.Sql,
      ...values: any[]
    ) {
      let query = ''
      let parameters: any = undefined

      const activeProvider = await this._getActiveProvider()

      if (typeof stringOrTemplateStringsArray === 'string') {
        // If this was called as prisma.$queryRaw(<SQL>, [...values]), assume it is a pre-prepared SQL statement, and forward it without any changes
        query = stringOrTemplateStringsArray
        parameters = {
          values: serializeRawParameters(values || []),
          __prismaRawParamaters__: true,
        }
      } else if (Array.isArray(stringOrTemplateStringsArray)) {
        // If this was called as prisma.$queryRaw`<SQL>`, try to generate a SQL prepared statement
        switch (activeProvider) {
          case 'sqlite':
          case 'mysql': {
            let queryInstance = sqlTemplateTag.sqltag(
              stringOrTemplateStringsArray as any,
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
            let queryInstance = sqlTemplateTag.sqltag(
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
            query = mssqlPreparedStatement(stringOrTemplateStringsArray)
            parameters = {
              values: serializeRawParameters(values),
              __prismaRawParamaters__: true,
            }
            break
          }
        }
      } else {
        // If this was called as prisma.raw(sql`<SQL>`), use prepared statements from sql-template-tag
        switch (activeProvider) {
          case 'sqlite':
          case 'mysql':
            query = (stringOrTemplateStringsArray as sqlTemplateTag.Sql).sql
            break
          case 'postgresql':
            query = (stringOrTemplateStringsArray as sqlTemplateTag.Sql).text
            break
          case 'sqlserver':
            query = mssqlPreparedStatement(
              (stringOrTemplateStringsArray as sqlTemplateTag.Sql).strings,
            )
            break
        }
        parameters = {
          values: serializeRawParameters(
            (stringOrTemplateStringsArray as sqlTemplateTag.Sql).values,
          ),
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
      return this._request({
        args,
        clientMethod: 'queryRaw',
        dataPath: [],
        action: 'queryRaw',
        callsite: this._getCallsite(),
        runInTransaction: false,
      })
    }

    /**
     * Executes a raw query. Always returns a number
     */
    $queryRaw(stringOrTemplateStringsArray, ...values: sqlTemplateTag.RawValue[]) {
      try {
        const promise = this.$queryRawInternal(stringOrTemplateStringsArray, ...values)
          ; (promise as any).isQueryRaw = true
        return promise
      } catch (e) {
        e.clientVersion = this._clientVersion
        throw e
      }
    }

    async __internal_triggerPanic(fatal: boolean) {
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

    private async $transactionInternal(promises: Array<any>): Promise<any> {
      for (const p of promises) {
        if (!p) {
          throw new Error(
            `All elements of the array need to be Prisma Client promises. Hint: Please make sure you are not awaiting the Prisma client calls you intended to pass in the $transaction function.`,
          )
        }
        if (
          (!p.requestTransaction ||
            typeof p.requestTransaction !== 'function') && (!p?.isQueryRaw && !p?.isExecuteRaw)
        ) {
          throw new Error(
            `All elements of the array need to be Prisma Client promises. Hint: Please make sure you are not awaiting the Prisma client calls you intended to pass in the $transaction function.`,
          )
        }
      }
      return Promise.all(promises.map((p) => {
        if (p.requestTransaction) {
          return p.requestTransaction()
        }
        return p
      }))
    }

    async $transaction(promises: Array<any>): Promise<any> {
      try {
        return this.$transactionInternal(promises)
      } catch (e) {
        e.clientVersion = this._clientVersion
        throw e
      }
    }

    private _request(internalParams: InternalRequestParams) {
      try {
        const resource = new AsyncResource('prisma-client-request')
        if (this._middlewares.length > 0) {
          // https://perf.link/#eyJpZCI6Img4bmd0anp5eGxrIiwidGl0bGUiOiJGaW5kaW5nIG51bWJlcnMgaW4gYW4gYXJyYXkgb2YgMTAwMCIsImJlZm9yZSI6ImNvbnN0IGRhdGEgPSB7XG4gIG9wZXJhdGlvbjogXCJxdWVyeVwiLFxuICByb290RmllbGQ6IFwiZmluZE1hbnlVc2VyXCIsXG4gIGFyZ3M6IHtcbiAgICB3aGVyZTogeyBpZDogeyBndDogNSB9IH1cbiAgfSxcbiAgZGF0YVBhdGg6IFtdLFxuICBjbGllbnRNZXRob2Q6ICd1c2VyLmZpbmRNYW55J1xufSIsInRlc3RzIjpbeyJuYW1lIjoiZm9yIGluIiwiY29kZSI6ImNvbnN0IG5ld0RhdGEgPSB7fVxuZm9yIChjb25zdCBrZXkgaW4gZGF0YSkge1xuICBpZiAoa2V5ICE9PSAnY2xpZW50TWV0aG9kJykge1xuICAgIG5ld0RhdGFba2V5XSA9IGRhdGFba2V5XVxuICB9XG59IiwicnVucyI6WzU1MzAwMCw0OTAwMDAsMzQ0MDAwLDYyNDAwMCwxMzkxMDAwLDEyMjQwMDAsMTA2NDAwMCwxMjE3MDAwLDc0MDAwLDM3MzAwMCw5MDUwMDAsNTM3MDAwLDE3MDYwMDAsOTAzMDAwLDE0MjUwMDAsMTMxMjAwMCw3NjkwMDAsMTM0NTAwMCwxOTQ4MDAwLDk5MDAwMCw5MDAwMDAsMTM0ODAwMCwxMDk2MDAwLDM4NjAwMCwxNTE3MDAwLDE5MzYwMDAsMTAwMCwyMTM0MDAwLDEzMjgwMDAsODI5MDAwLDE1ODYwMDAsMTc2MzAwMCw1MDgwMDAsOTg2MDAwLDE5NDkwMDAsMjEwODAwMCwxNjA4MDAwLDIyNDAwMCwxOTAyMDAwLDEyNjgwMDAsMjEzNDAwMCwxNzEwMDAwLDEzNzIwMDAsMjExMDAwMCwxNzgwMDAwLDc3NzAwMCw1NzgwMDAsNDAwMCw4OTAwMDAsMTEwMTAwMCwxNTk0MDAwLDE3ODAwMDAsMzU0MDAwLDU0NDAwMCw4MjQwMDAsNzEwMDAwLDg0OTAwMCwxNjQwMDAwLDE5ODQwMDAsNzAzMDAwLDg4MjAwMCw4NTAwMDAsMTA2MDAwLDMwMzAwMCwxMzMwMDAsNjA4MDAwLDIxMzQwMDAsNTUxMDAwLDc0MjAwMCwyMDcwMDAsMTU3NTAwMCwxMzQwMDAsNDAwMCwxMDAwLDQ5NDAwMCwyNTAwMDAsMTQwMjAwMCw2OTgwMDAsNTgxMDAwLDQ4MDAwMCwyMDMwMDAsMTY4MzAwMCwxNjcxMDAwLDEyNDAwMDAsMTk1NjAwMCwzMDUwMDAsODkwMDAsNjUzMDAwLDE3MDgwMDAsMTYwMTAwMCwxOTg0MDAwLDg4ODAwMCwyMTAwMDAwLDE5NzUwMDAsNTM2MDAwLDU3NTAwMCwyMTM0MDAwLDEwMTcwMDAsMTI5NzAwMCw3NTYwMDBdLCJvcHMiOjEwNDUxNTB9LHsibmFtZSI6IkRlY29uc3RydWN0b3IiLCJjb2RlIjoiY29uc3QgeyBjbGllbnRNZXRob2QsIC4uLnJlc3QgfSA9IGRhdGEiLCJydW5zIjpbMjE0MDAwLDUxMDAwLDg2NDAwMCw3MjcwMDAsNDMxMDAwLDIyMDAwMCwzOTAwMDAsODQxMDAwLDIyOTAwMCw3MjIwMDAsNDEzMDAwLDYwODAwMCwyOTgwMDAsMzY4MDAwLDg2NDAwMCw5MjQwMDAsMTI4MDAwLDU1MzAwMCw4ODAwMDAsNTQ1MDAwLDc3NTAwMCw0MzAwMDAsMjM3MDAwLDc4NjAwMCw1NTUwMDAsNTI2MDAwLDMyNzAwMCw2MzAwMCw5MTIwMDAsMTgxMDAwLDMzMTAwMCw0MzAwMCwyMjUwMDAsNTQ3MDAwLDgyMjAwMCw3OTMwMDAsMTA1NzAwMCw1NjAwMCwyNzUwMDAsMzkzMDAwLDgwNTAwMCw5MzAwMCw3NjYwMDAsODM0MDAwLDUwMzAwMCw4MDAwMCwyMzgwMDAsNDY0MDAwLDU2NDAwMCw3MzAwMDAsOTU1MDAwLDgwOTAwMCwyMDMwMDAsNDEzMDAwLDM0NDAwMCw1MDIwMDAsNjEzMDAwLDEwMDAwMCw0MzIwMDAsNjcwMDAwLDQ1MzAwMCw4OTEwMDAsNTUwMDAsMjMwMDAwLDM5MTAwMCw3NTQwMDAsMTEyMjAwMCw3NjIwMDAsMzU3MDAwLDQ3MDAwLDc5MjAwMCwzNTQwMDAsMTA4MDAwMCwxNjAwMCwxODgwMDAsMTQxMDAwLDIxMDAwMCw2MDcwMDAsOTAyMDAwLDgyNTAwMCwxOTAwMDAsMjMzMDAwLDI4MzAwMCwyMzgwMDAsNjk2MDAwLDc2ODAwMCw3NTgwMDAsMTk0MDAwLDI3OTAwMCwyMjMwMDAsMjM4MDAwLDkzNDAwMCw2MDUwMDAsMTcwMDAsMjEwMDAwLDMyMjAwMCwxMDM0MDAwLDgxMjAwMCw0NDYwMDAsNjMxMDAwXSwib3BzIjo0OTAxMDB9LHsibmFtZSI6ImRlbGV0ZSIsImNvZGUiOiJjb25zdCB7IGNsaWVudE1ldGhvZCB9ID0gZGF0YVxuZGVsZXRlIGRhdGEuY2xpZW50TWV0aG9kIiwicnVucyI6WzI3NjIwMDAsNjIyMDAwLDEwNTcwMDAsMzIzMTAwMCwzNDQ2MDAwLDIwNzMwMDAsMzM4MjAwMCwyNzA0MDAwLDM4ODEwMDAsMTIwMTAwMCwzNzk3MDAwLDI1OTAwMCwxMDI4MDAwLDI1MTgwMDAsMjEwMjAwMCwxOTczMDAwLDM0MTIwMDAsMzU4MDAwLDExNDcwMDAsMTA3NDAwMCwzMTk1MDAwLDM2NzUwMDAsNTQ3MDAwLDIwNzkwMDAsMjc0NTAwMCwyNDE1MDAwLDIxOTAwMCwzNzM3MDAwLDM2OTIwMDAsMTY0MDAwLDI0MzMwMDAsNjQzMDAwLDcxODAwMCw0Mzg2MDAwLDE3MDIwMDAsMTAyNDAwMCw1NjUwMDAsNDIxOTAwMCwxMTk3MDAwLDE4MzkwMDAsMzgyMTAwMCwxMTUyMDAwLDg1MzAwMCwxMzczMDAwLDI5NTAwMCwxNDg5MDAwLDE0MjEwMDAsMjcyNDAwMCw1MDYxMDAwLDI2NTcwMDAsMjYzNzAwMCwyOTkwMDAsMjE1NzAwMCwxNTAxMDAwLDM2OTAwMDAsMzU3OTAwMCw0MjE5MDAwLDI4NTgwMDAsNTI0MzAwMCwxNTA0MDAwLDEyMTMwMDAsMjM4NDAwMCw3NzgwMDAsMjgyNjAwMCwxNzQ5MDAwLDM2MjAwMCwyNzEzMDAwLDMzODYwMDAsMzE2NjAwMCwxNTMwMDAsNzk0MDAwLDMyMTcwMDAsMjA4MjAwMCw0MTUwMDAsMzMyMDAwMCwyMTA1MDAwLDE1NzYwMDAsMjUxMDAwLDIzMjkwMDAsOTI1MDAwLDM3MTUwMDAsNjkyMDAwLDE5MDIwMDAsMjA0NzAwMCwyNTM5MDAwLDIwMjkwMDAsMzE3OTAwMCwyMTA2MDAwLDg5NTAwMCwxNTUwMDAwLDYwNzAwMCw0MTA1MDAwLDM0ODMwMDAsMzcxNTAwMCw0OTQwMDAwLDIyODAwMCw0MDI2MDAwLDE2MTYwMDAsMzMxNDAwMCwyNDIyMDAwXSwib3BzIjoyMTY2MDgwfSx7Im5hbWUiOiJDcmVhdGUgbmV3IG9iamVjdCIsImNvZGUiOiJjb25zdCBuZXdEYXRhID0ge1xuICBvcGVyYXRpb246IGRhdGEub3BlcmF0aW9uLFxuICByb290RmllbGQ6IGRhdGEucm9vdEZpZWxkLFxuICBhcmdzOiBkYXRhLmFyZ3MsXG4gIGRhdGFQYXRoOiBkYXRhLmRhdGFQYXRoXG59IiwicnVucyI6WzcwNTAwMCwxMTAwMDAsMzI3NTAwMCwxOTgwMDAsMjE5OTAwMCw0MzYwMDAsODI4MDAwLDI5MjcwMDAsNzI0MDAwLDI1NDAwMCwyOTgzMDAwLDI2NzIwMDAsMjUzMDAwLDI4MjcwMDAsMzA0ODAwMCwyOTA3MDAwLDM0OTkwMDAsMjY1OTAwMCwzODIyMDAwLDI3NzcwMDAsMzc5NzAwMCw4MDAwMDAsNDM1MDAwLDExOTMwMDAsMTAwMDAsMTQ0MDAwMCw3NTcwMDAsMTMyMDAwMCwzMjIwMDAsMjA3MDAwLDM2ODAwMDAsMzkxMTAwMCwzMjQxMDAwLDExMDcwMDAsNDM4MDAwLDMwNDQwMDAsMTA3NjAwMCwyMTAwMDAsNDIxOTAwMCwzNzQ4MDAwLDQwNjcwMDAsNzc0MDAwLDYzMDAwLDMyMTAwMCwzMDQ4MDAwLDMxMjgwMDAsMTg3MTAwMCwzNTkxMDAwLDI0MzcwMDAsNjcxMDAwLDc5OTAwMCwxMTUzMDAwLDIxMTMwMDAsOTUwMDAsNTg3MDAwLDYyMzAwMCwxMzEzMDAwLDMxNTgwMDAsMzMyNzAwMCwxNTkwMDAsNDg4MDAwLDIxMTAwMCwxMjk0MDAwLDExNTcwMDAsNDA0MDAwLDM2MjMwMDAsMjY4NDAwMCw4NzkwMDAsMjE4NTAwMCwxNTkyMDAwLDM2ODcwMDAsMjI0ODAwMCwyMjE4MDAwLDE3NDMwMDAsNzg4MDAwLDQwODYwMDAsMjExNTAwMCwzOTE0MDAwLDM5MjgwMDAsNDM3MjAwMCwxOTkwMDAsMzc1MzAwMCwzNjQ3MDAwLDE2MjcwMDAsMTQ5OTAwMCwxODQyMDAwLDIxMjkwMDAsNDAwMCwxMjIzMDAwLDI4NjMwMDAsMzgzNDAwMCwzNjk0MDAwLDYzNjAwMCw0MjQ3MDAwLDQwMjIwMDAsMTAwMDAsMTcxNDAwMCwxNzUwMDAwLDI5MDEwMDAsMTM0NjAwMF0sIm9wcyI6MTkzOTEyMH1dLCJ1cGRhdGVkIjoiMjAyMC0wNy0xNVQxMTowMDo1Ny45MzhaIn0%3D
          const params: MiddlewareParams = {
            args: internalParams.args,
            dataPath: internalParams.dataPath,
            runInTransaction: internalParams.runInTransaction,
            action: internalParams.action,
            model: internalParams.model,
          }
          return resource.runInAsyncScope(() =>
            this._requestWithMiddlewares(
              params,
              this._middlewares.slice(),
              internalParams.clientMethod,
              internalParams.callsite,
              internalParams.headers,
            ),
          )
        }

        return resource.runInAsyncScope(() =>
          this._executeRequest(internalParams),
        )
      } catch (e) {
        e.clientVersion = this._clientVersion
        throw e
      }
    }

    private _requestWithMiddlewares(
      params: MiddlewareParams,
      middlewares: Middleware[],
      clientMethod: string,
      callsite?: string,
      headers?: Record<string, string>,
    ) {
      const middleware = middlewares.shift()
      if (middleware) {
        return middleware(params, (params2) =>
          this._requestWithMiddlewares(
            params2,
            middlewares,
            clientMethod,
            callsite,
          ),
        )
      }

      // No, we won't copy the whole object here just to make it easier to do TypeScript
      // as it would be much slower
      ; (params as InternalRequestParams).clientMethod = clientMethod
        ; (params as InternalRequestParams).callsite = callsite
        ; (params as InternalRequestParams).headers = headers

      return this._executeRequest(params as InternalRequestParams)
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
    }: InternalRequestParams) {
      if (action !== 'executeRaw' && action !== 'queryRaw' && !model) {
        throw new Error(`Model missing for action ${action}`)
      }

      if ((action === 'executeRaw' || action === 'queryRaw') && model) {
        throw new Error(
          `executeRaw and queryRaw can't be executed on a model basis. The model ${model} has been provided`,
        )
      }
      if (action === 'findOne') action = 'findUnique'
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
      if (Debug.enabled('prisma-client')) {
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
        isList,
        rootField: rootField!,
        callsite,
        showColors: this._errorFormat === 'pretty',
        args,
        engineHook: this._engineMiddlewares[0],
        runInTransaction,
        headers,
      })
    }

    private _bootstrapClient() {
      const clients = this._dmmf.mappings.modelOperations.reduce((acc, mapping) => {
        const lowerCaseModel = lowerCase(mapping.model)
        const model = this._dmmf.modelMap[mapping.model]

        if (!model) {
          throw new Error(`Invalid mapping ${mapping.model}, can't find model`)
        }

        const prismaClient = ({
          operation,
          actionName,
          args,
          dataPath,
          modelName,
        }) => {
          if (actionName === 'findOne') {
            console.warn(`${chalk.yellow('warn(prisma) ')} findOne is deprecated. Please use findUnique instead.`)
          }
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
                })
              }

              return requestPromise.then(onfulfilled, onrejected)
            },
            requestTransaction: () => {
              if (!requestPromise) {
                requestPromise = this._request({
                  args,
                  dataPath,
                  action: actionName,
                  model: requestModelName,
                  clientMethod,
                  callsite,
                  runInTransaction: true,
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
                })
              }

              return requestPromise.finally(onfinally)
            },
          }

          // add relation fields
          for (const field of model.fields.filter((f) => f.kind === 'object')) {
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
      }, {})

      for (const mapping of this._dmmf.mappings.modelOperations) {
        const lowerCaseModel = lowerCase(mapping.model)

        const denyList = {
          model: true,
          plural: true,
          aggregate: true,
        }

        const newMapping = {
          ...mapping,
          findOne: mapping.findUnique
        }

        const delegate: any = Object.entries(newMapping).reduce(
          (acc, [actionName, rootField]) => {
            if (!denyList[actionName]) {
              const operation = getOperation(actionName as any)
              acc[actionName] = (args) =>
                clients[mapping.model]({
                  operation,
                  actionName,
                  args,
                })
            }

            return acc
          },
          {},
        )

        delegate.count = (args) => {
          return clients[mapping.model]({
            operation: 'query',
            actionName: `aggregate`,
            args: args
              ? {
                ...args,
                select: { count: true },
              }
              : undefined,
            dataPath: ['count'],
          })
        }

        delegate.aggregate = (args) => {
          /**
           * avg, count, sum, min, max need to go into select
           * For speed reasons we can go with "for in "
           */
          const select = Object.entries(args).reduce((acc, [key, value]) => {
            if (aggregateKeys[key]) {
              if (!acc.select) {
                acc.select = {}
              }
              // `count` doesn't have a sub-selection
              if (key === 'count') {
                acc.select[key] = value
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
          })
        }

        this[lowerCaseModel] = delegate
      }
    }
  }

  return NewPrismaClient
}

export class PrismaClientFetcher {
  prisma: any
  debug: boolean
  hooks: any
  dataloader: Dataloader<{
    document: Document
    runInTransaction?: boolean
    headers?: Record<string, string>
  }>

  constructor(prisma, enableDebug = false, hooks?: any) {
    this.prisma = prisma
    this.debug = enableDebug
    this.hooks = hooks
    this.dataloader = new Dataloader({
      batchLoader: async (requests) => {
        const queries = requests.map((r) => String(r.document))
        const runTransaction = requests[0].runInTransaction
        return this.prisma._engine.requestBatch(queries, runTransaction)
      },
      singleLoader: async (request) => {
        const query = String(request.document)
        return this.prisma._engine.request(query, request.headers)
      },
      batchBy: (request) => {
        if (request.runInTransaction) {
          return 'transaction-batch'
        }

        if (!(request.document.children[0].name.startsWith('findOne') || request.document.children[0].name.startsWith('findUnique'))) {
          return null
        }

        const selectionSet = request.document.children[0].children!.join(',')

        const args = request.document.children[0].args?.args
          .map((a) => {
            if (a.value instanceof Args) {
              return a.key + '-' + a.value.args.map((a) => a.key).join(',')
            }
            return a.key
          })
          .join(',')

        return `${request.document.children[0].name}|${args}|${selectionSet}`
      },
    })
  }

  async request({
    document,
    dataPath = [],
    rootField,
    typeName,
    isList,
    callsite,
    clientMethod,
    runInTransaction,
    showColors,
    engineHook,
    args,
    headers,
  }: {
    document: Document
    dataPath: string[]
    rootField: string
    typeName: string
    isList: boolean
    clientMethod: string
    callsite?: string
    runInTransaction?: boolean
    showColors?: boolean
    engineHook?: EngineMiddleware
    args: any
    headers?: Record<string, string>
  }) {
    if (this.hooks && this.hooks.beforeRequest) {
      const query = String(document)
      this.hooks.beforeRequest({
        query,
        path: dataPath,
        rootField,
        typeName,
        document,
        isList,
        clientMethod,
        args,
      })
    }
    try {
      /**
       * If there's an engine hook, use it here
       */
      let data, elapsed
      if (engineHook) {
        const result = await engineHook(
          {
            document,
            runInTransaction,
          },
          (params) => this.dataloader.request(params),
        )
        data = result.data
        elapsed = result.elapsed
      } else {
        const result = await this.dataloader.request({
          document,
          runInTransaction,
          headers,
        })
        data = result.data
        elapsed = result.elapsed
      }

      /**
       * Unpack
       */
      const unpackResult = this.unpack(document, data, dataPath, rootField)
      if (process.env.PRISMA_CLIENT_GET_TIME) {
        return { data: unpackResult, elapsed }
      }
      return unpackResult
    } catch (e) {
      debug(e)
      let message = e.message
      if (callsite) {
        const { stack } = printStack({
          callsite,
          originalMethod: clientMethod,
          onUs: e.isPanic,
          showColors,
        })
        message = stack + '\n  ' + e.message
      }

      message = this.sanitizeMessage(message)
      // TODO: Do request with callsite instead, so we don't need to rethrow
      if (e.code) {
        throw new PrismaClientKnownRequestError(
          message,
          e.code,
          this.prisma._clientVersion,
          e.meta,
        )
      } else if (e.isPanic) {
        throw new PrismaClientRustPanicError(
          message,
          this.prisma._clientVersion,
        )
      } else if (e instanceof PrismaClientUnknownRequestError) {
        throw new PrismaClientUnknownRequestError(
          message,
          this.prisma._clientVersion,
        )
      } else if (e instanceof PrismaClientInitializationError) {
        throw new PrismaClientInitializationError(
          message,
          this.prisma._clientVersion,
        )
      } else if (e instanceof PrismaClientRustPanicError) {
        throw new PrismaClientRustPanicError(
          message,
          this.prisma._clientVersion,
        )
      }

      e.clientVersion = this.prisma._clientVersion

      throw e
    }
  }

  sanitizeMessage(message) {
    if (this.prisma._errorFormat && this.prisma._errorFormat !== 'pretty') {
      return stripAnsi(message)
    }
    return message
  }
  unpack(document, data, path, rootField) {
    if (data.data) {
      data = data.data
    }
    const getPath: any[] = []
    if (rootField) {
      getPath.push(rootField)
    }
    getPath.push(...path.filter((p) => p !== 'select' && p !== 'include'))
    return unpack({ document, data, path: getPath })
  }
}

export function getOperation(action: DMMF.ModelAction | 'findOne'): 'query' | 'mutation' {
  if (
    action === DMMF.ModelAction.findMany ||
    action === DMMF.ModelAction.findUnique ||
    action === 'findOne' ||
    action === DMMF.ModelAction.findFirst
  ) {
    return 'query'
  }
  return 'mutation'
}
