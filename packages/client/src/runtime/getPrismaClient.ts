import { Context, context } from '@opentelemetry/api'
import Debug, { clearLogs } from '@prisma/debug'
import {
  BatchTransactionOptions,
  BinaryEngine,
  DataProxyEngine,
  DatasourceOverwrite,
  Engine,
  EngineConfig,
  EngineEventType,
  Fetch,
  getTraceParent,
  getTracingConfig,
  LibraryEngine,
  Options,
  runInChildSpan,
  SpanOptions,
  TracingConfig,
} from '@prisma/engine-core'
import type { GeneratorConfig } from '@prisma/generator-helper'
import {
  callOnce,
  ClientEngineType,
  getClientEngineType,
  getQueryEngineProtocol,
  logger,
  QueryEngineProtocol,
  tryLoadEnvs,
  warnOnce,
} from '@prisma/internals'
import type { LoadedEnv } from '@prisma/internals/dist/utils/tryLoadEnvs'
import { AsyncResource } from 'async_hooks'
import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import { RawValue, Sql } from 'sql-template-tag'

import { getPrismaClientDMMF } from '../generation/getDMMF'
import type { InlineDatasources } from '../generation/utils/buildInlineDatasources'
import { PrismaClientValidationError } from '.'
import { $extends } from './core/extensions/$extends'
import { applyQueryExtensions } from './core/extensions/applyQueryExtensions'
import { MergedExtensionsList } from './core/extensions/MergedExtensionsList'
import { checkPlatformCaching } from './core/init/checkPlatformCaching'
import { MetricsClient } from './core/metrics/MetricsClient'
import { applyModelsAndClientExtensions } from './core/model/applyModelsAndClientExtensions'
import { dmmfToJSModelName } from './core/model/utils/dmmfToJSModelName'
import { ProtocolEncoder } from './core/protocol/common'
import { GraphQLProtocolEncoder } from './core/protocol/graphql'
import { JsonProtocolEncoder } from './core/protocol/json'
import { RawQueryArgs } from './core/raw-query/RawQueryArgs'
import { rawQueryArgsMapper } from './core/raw-query/rawQueryArgsMapper'
import { createPrismaPromise } from './core/request/createPrismaPromise'
import {
  PrismaPromise,
  PrismaPromiseInteractiveTransaction,
  PrismaPromiseTransaction,
} from './core/request/PrismaPromise'
import { UserArgs } from './core/request/UserArgs'
import { getLockCountPromise } from './core/transaction/utils/createLockCountPromise'
import { BaseDMMFHelper, DMMFHelper } from './dmmf'
import type { DMMF } from './dmmf-types'
import { getLogLevel } from './getLogLevel'
import { mergeBy } from './mergeBy'
import type { QueryMiddleware, QueryMiddlewareParams } from './MiddlewareHandler'
import { MiddlewareHandler } from './MiddlewareHandler'
import { RequestHandler } from './RequestHandler'
import { CallSite, getCallSite } from './utils/CallSite'
import { clientVersion } from './utils/clientVersion'
import { deserializeRawResults } from './utils/deserializeRawResults'
import { printJsonWithErrors } from './utils/printJsonErrors'
import type { InstanceRejectOnNotFound, RejectOnNotFound } from './utils/rejectOnNotFound'
import { getRejectOnNotFound } from './utils/rejectOnNotFound'
import { validatePrismaClientOptions } from './utils/validatePrismaClientOptions'
import { waitForBatch } from './utils/waitForBatch'

const debug = Debug('prisma:client')

declare global {
  // eslint-disable-next-line no-var
  var NODE_CLIENT: true
  const TARGET_ENGINE_TYPE: 'binary' | 'library' | 'data-proxy' | 'all'
}

// used by esbuild for tree-shaking
typeof globalThis === 'object' ? (globalThis.NODE_CLIENT = true) : 0

if (typeof TARGET_ENGINE_TYPE !== 'undefined' && TARGET_ENGINE_TYPE === 'all') {
  console.warn('imports from "@prisma/client/runtime" are deprecated.')
  console.warn(
    'Use "@prisma/client/runtime/library",  "@prisma/client/runtime/data-proxy" or  "@prisma/client/runtime/binary"',
  )
}

export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'

export type Datasource = {
  url?: string
}
export type Datasources = { [name in string]: Datasource }

export interface PrismaClientOptions {
  /**
   * Will throw an Error if findUnique returns null
   */
  rejectOnNotFound?: InstanceRejectOnNotFound
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
    engine?: {
      cwd?: string
      binaryPath?: string
      endpoint?: string
      allowTriggerPanic?: boolean
    }
  }
}

export type Unpacker = (data: any) => any

export type InternalRequestParams = {
  /**
   * The original client method being called.
   * Even though the rootField / operation can be changed,
   * this method stays as it is, as it's what the user's
   * code looks like
   */
  clientMethod: string // TODO what is this
  /**
   * Name of js model that triggered the request. Might be used
   * for warnings or error messages
   */
  jsModelName?: string
  // Extra headers for data proxy.
  callsite?: CallSite
  transaction?: PrismaPromiseTransaction
  unpacker?: Unpacker // TODO what is this
  otelParentCtx?: Context
  /** Used to "desugar" a user input into an "expanded" one */
  argsMapper?: (args?: UserArgs) => UserArgs
  /** Used for Accelerate client extension via Data Proxy */
  customDataProxyFetch?: (fetch: Fetch) => Fetch
} & Omit<QueryMiddlewareParams, 'runInTransaction'>

/* Types for Logging */
export type LogLevel = 'info' | 'query' | 'warn' | 'error'
export type LogDefinition = {
  level: LogLevel
  emit: 'stdout' | 'event'
}

export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition
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

/**
 * Config that is stored into the generated client. When the generated client is
 * loaded, this same config is passed to {@link getPrismaClient} which creates a
 * closure with that config around a non-instantiated [[PrismaClient]].
 */
export interface GetPrismaClientConfig {
  document: Omit<DMMF.Document, 'schema'>
  generator?: GeneratorConfig
  sqliteDatasourceOverrides?: DatasourceOverwrite[]
  relativeEnvPaths: {
    rootEnvPath?: string | null
    schemaEnvPath?: string | null
  }
  relativePath: string
  dirname: string
  filename?: string
  clientVersion: string
  engineVersion?: string
  datasourceNames: string[]
  activeProvider: string

  /**
   * True when `--data-proxy` is passed to `prisma generate`
   * If enabled, we disregard the generator config engineType.
   * It means that `--data-proxy` binds you to the Data Proxy.
   */
  dataProxy: boolean

  /**
   * The contents of the schema encoded into a string
   * @remarks only used for the purpose of data proxy
   */
  inlineSchema?: string

  /**
   * A special env object just for the data proxy edge runtime.
   * Allows bundlers to inject their own env variables (Vercel).
   * Allows platforms to declare global variables as env (Workers).
   * @remarks only used for the purpose of data proxy
   */
  injectableEdgeEnv?: LoadedEnv

  /**
   * Engine protocol to use within edge runtime. Passed
   * through config because edge client can not read env variables
   * @remarks only used for the purpose of data proxy
   */
  edgeClientProtocol?: QueryEngineProtocol

  /**
   * The contents of the datasource url saved in a string.
   * This can either be an env var name or connection string.
   * It is needed by the client to connect to the Data Proxy.
   * @remarks only used for the purpose of data proxy
   */
  inlineDatasources?: InlineDatasources

  /**
   * The string hash that was produced for a given schema
   * @remarks only used for the purpose of data proxy
   */
  inlineSchemaHash?: string

  /**
   * A marker to indicate that the client was not generated via `prisma
   * generate` but was triggered via the `postinstall` script instead.
   * @remarks used to error for Vercel/Netlify for schema caching issues
   */
  postinstall?: boolean

  /**
   * Information about the CI where the Prisma Client has been generated. The
   * name of the CI environment is stored at generation time because CI
   * information is not always available at runtime. Moreover, the edge client
   * has no notion of environment variables, so this works around that.
   * @remarks used to error for Vercel/Netlify for schema caching issues
   */
  ciName?: string
}

const TX_ID = Symbol.for('prisma.client.transaction.id')

const BatchTxIdCounter = {
  id: 0,
  nextId() {
    return ++this.id
  },
}

export type Client = ReturnType<typeof getPrismaClient> extends new () => infer T ? T : never

export function getPrismaClient(config: GetPrismaClientConfig) {
  class PrismaClient {
    _baseDmmf: BaseDMMFHelper
    _dmmf?: DMMFHelper
    _engine: Engine
    _fetcher: RequestHandler
    _connectionPromise?: Promise<any>
    _disconnectionPromise?: Promise<any>
    _engineConfig: EngineConfig
    _clientVersion: string
    _errorFormat: ErrorFormat
    _clientEngineType: ClientEngineType
    _tracingConfig: TracingConfig
    _metrics: MetricsClient
    _middlewares = new MiddlewareHandler<QueryMiddleware>()
    _previewFeatures: string[]
    _activeProvider: string
    _rejectOnNotFound?: InstanceRejectOnNotFound
    _dataProxy: boolean
    _extensions: MergedExtensionsList

    constructor(optionsArg?: PrismaClientOptions) {
      checkPlatformCaching(config)

      if (optionsArg) {
        validatePrismaClientOptions(optionsArg, config.datasourceNames)
      }

      const logEmitter = new EventEmitter().on('error', (e) => {
        // this is a no-op to prevent unhandled error events
        //
        // If the user enabled error logging this would never be executed. If the user did not
        // enabled error logging, this would be executed, and a trace for the error would be logged
        // in debug mode, which is like going in the opposite direction than what the user wanted by
        // not enabling error logging in the first place.
      })

      this._extensions = MergedExtensionsList.empty()
      this._previewFeatures = config.generator?.previewFeatures ?? []
      this._rejectOnNotFound = optionsArg?.rejectOnNotFound
      this._clientVersion = config.clientVersion ?? clientVersion
      this._activeProvider = config.activeProvider
      this._dataProxy = config.dataProxy
      this._tracingConfig = getTracingConfig(this._previewFeatures)
      this._clientEngineType = getClientEngineType(config.generator!)
      const envPaths = {
        rootEnvPath:
          config.relativeEnvPaths.rootEnvPath && path.resolve(config.dirname, config.relativeEnvPaths.rootEnvPath),
        schemaEnvPath:
          config.relativeEnvPaths.schemaEnvPath && path.resolve(config.dirname, config.relativeEnvPaths.schemaEnvPath),
      }

      const loadedEnv = NODE_CLIENT && tryLoadEnvs(envPaths, { conflictCheck: 'none' })

      try {
        const options: PrismaClientOptions = optionsArg ?? {}
        const internal = options.__internal ?? {}

        const useDebug = internal.debug === true
        if (useDebug) {
          Debug.enable('prisma:client')
        }

        let cwd = path.resolve(config.dirname, config.relativePath)

        // TODO this logic should not be needed anymore #findSync
        if (!fs.existsSync(cwd)) {
          cwd = config.dirname
        }

        debug('dirname', config.dirname)
        debug('relativePath', config.relativePath)
        debug('cwd', cwd)

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

        // TODO: isn't it equivalent to just `inputDatasources` if the first argument is `[]`?
        const datasources = mergeBy([], inputDatasources, (source: any) => source.name)

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

        this._baseDmmf = new BaseDMMFHelper(config.document)
        const engineProtocol = NODE_CLIENT
          ? getQueryEngineProtocol(config.generator)
          : config.edgeClientProtocol ?? getQueryEngineProtocol(config.generator)

        debug('protocol', engineProtocol)

        if (this._dataProxy && engineProtocol === 'graphql') {
          // the data proxy can't get the dmmf from the engine
          // so the generated client always has the full dmmf
          const rawDmmf = config.document as DMMF.Document
          this._dmmf = new DMMFHelper(rawDmmf)
        }

        this._engineConfig = {
          cwd,
          dirname: config.dirname,
          enableDebugLogs: useDebug,
          allowTriggerPanic: engineConfig.allowTriggerPanic,
          datamodelPath: path.join(config.dirname, config.filename ?? 'schema.prisma'),
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
                : options.log.find((o) => (typeof o === 'string' ? o === 'query' : o.level === 'query')),
            ),
          // we attempt to load env with fs -> attempt edge env -> default
          env: loadedEnv?.parsed ?? config.injectableEdgeEnv?.parsed ?? {},
          flags: [],
          clientVersion: config.clientVersion,
          previewFeatures: this._previewFeatures,
          activeProvider: config.activeProvider,
          inlineSchema: config.inlineSchema,
          inlineDatasources: config.inlineDatasources,
          inlineSchemaHash: config.inlineSchemaHash,
          tracingConfig: this._tracingConfig,
          logEmitter: logEmitter,
          engineProtocol,
        }

        debug('clientVersion', config.clientVersion)
        debug('clientEngineType', this._dataProxy ? 'dataproxy' : this._clientEngineType)

        if (this._dataProxy) {
          const runtime = NODE_CLIENT ? 'Node.js' : 'edge'
          debug(`using Data Proxy with ${runtime} runtime`)
        }

        this._engine = this.getEngine()

        this._fetcher = new RequestHandler(this, logEmitter) as any

        if (options.log) {
          for (const log of options.log) {
            const level = typeof log === 'string' ? log : log.emit === 'stdout' ? log.level : null
            if (level) {
              this.$on(level, (event) => {
                logger.log(`${logger.tags[level] ?? ''}`, event.message || event.query)
              })
            }
          }
        }

        this._metrics = new MetricsClient(this._engine)
      } catch (e: any) {
        e.clientVersion = this._clientVersion
        throw e
      }

      return applyModelsAndClientExtensions(this) // custom constructor return value
    }
    get [Symbol.toStringTag]() {
      return 'PrismaClient'
    }

    getEngine(): Engine {
      if (this._dataProxy === true && (TARGET_ENGINE_TYPE === 'data-proxy' || TARGET_ENGINE_TYPE === 'all')) {
        return new DataProxyEngine(this._engineConfig)
      } else if (
        this._clientEngineType === ClientEngineType.Library &&
        (TARGET_ENGINE_TYPE === 'library' || TARGET_ENGINE_TYPE === 'all')
      ) {
        return new LibraryEngine(this._engineConfig)
      } else if (
        this._clientEngineType === ClientEngineType.Binary &&
        (TARGET_ENGINE_TYPE === 'binary' || TARGET_ENGINE_TYPE === 'all')
      ) {
        return new BinaryEngine(this._engineConfig)
      }

      throw new PrismaClientValidationError('Invalid client engine type, please use `library` or `binary`')
    }

    /**
     * Hook a middleware into the client
     * @param middleware to hook
     */
    $use<T>(middleware: QueryMiddleware) {
      this._middlewares.use(middleware)
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
      } catch (e: any) {
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
    }

    /**
     * Disconnect from the database
     */
    async $disconnect() {
      try {
        await this._engine.stop()
      } catch (e: any) {
        e.clientVersion = this._clientVersion
        throw e
      } finally {
        // Debug module keeps a list of last 100 logs regardless of environment variables.
        // This can cause a memory leak. It's especially bad in jest environment where keeping an
        // error in this list will prevent jest sandbox from being GCed. Clearing logs on disconnect
        // helps to avoid that
        clearLogs()
        if (!this._dataProxy) {
          this._dmmf = undefined
        }
      }
    }

    /**
     * Executes a raw query and always returns a number
     */
    $executeRawInternal(
      transaction: PrismaPromiseTransaction | undefined,
      clientMethod: string,
      args: RawQueryArgs,
    ): Promise<number> {
      return this._request({
        action: 'executeRaw',
        args,
        transaction,
        clientMethod,
        argsMapper: rawQueryArgsMapper(this, clientMethod),
        callsite: getCallSite(this._errorFormat),
        dataPath: [],
      })
    }

    /**
     * Executes a raw query provided through a safe tag function
     * @see https://github.com/prisma/prisma/issues/7142
     *
     * @param query
     * @param values
     * @returns
     */
    $executeRaw(query: TemplateStringsArray | Sql, ...values: any[]) {
      return createPrismaPromise((transaction) => {
        if ((query as TemplateStringsArray).raw !== undefined || (query as Sql).sql !== undefined) {
          return this.$executeRawInternal(transaction, '$executeRaw', [query, ...values])
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
    $executeRawUnsafe(query: string, ...values: RawValue[]) {
      return createPrismaPromise((transaction) => {
        return this.$executeRawInternal(transaction, '$executeRawUnsafe', [query, ...values])
      })
    }

    /**
     * Executes a raw command only for MongoDB
     *
     * @param command
     * @returns
     */
    $runCommandRaw(command: object) {
      if (config.activeProvider !== 'mongodb') {
        throw new PrismaClientValidationError(
          `The ${config.activeProvider} provider does not support $runCommandRaw. Use the mongodb provider.`,
        )
      }

      return createPrismaPromise((transaction) => {
        return this._request({
          args: { command: command },
          clientMethod: '$runCommandRaw',
          dataPath: [],
          action: 'runCommandRaw',
          callsite: getCallSite(this._errorFormat),
          transaction: transaction,
        })
      })
    }

    /**
     * Executes a raw query and returns selected data
     */
    async $queryRawInternal(
      transaction: PrismaPromiseTransaction | undefined,
      clientMethod: string,
      args: RawQueryArgs,
    ) {
      return this._request({
        action: 'queryRaw',
        args,
        transaction,
        clientMethod,
        argsMapper: rawQueryArgsMapper(this, clientMethod),
        callsite: getCallSite(this._errorFormat),
        dataPath: [],
      }).then(deserializeRawResults)
    }

    /**
     * Executes a raw query provided through a safe tag function
     * @see https://github.com/prisma/prisma/issues/7142
     *
     * @param query
     * @param values
     * @returns
     */
    $queryRaw(query: TemplateStringsArray | Sql, ...values: any[]) {
      return createPrismaPromise((transaction) => {
        if ((query as TemplateStringsArray).raw !== undefined || (query as Sql).sql !== undefined) {
          return this.$queryRawInternal(transaction, '$queryRaw', [query, ...values])
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
    $queryRawUnsafe(query: string, ...values: RawValue[]) {
      return createPrismaPromise((transaction) => {
        return this.$queryRawInternal(transaction, '$queryRawUnsafe', [query, ...values])
      })
    }

    /**
     * Execute a batch of requests in a transaction
     * @param requests
     * @param options
     */
    _transactionWithArray({
      promises,
      options,
    }: {
      promises: Array<PrismaPromise<any>>
      options?: BatchTransactionOptions
    }): Promise<any> {
      const id = BatchTxIdCounter.nextId()
      const lock = getLockCountPromise(promises.length)

      const requests = promises.map((request, index) => {
        if (request?.[Symbol.toStringTag] !== 'PrismaPromise') {
          throw new Error(
            `All elements of the array need to be Prisma Client promises. Hint: Please make sure you are not awaiting the Prisma client calls you intended to pass in the $transaction function.`,
          )
        }

        const isolationLevel = options?.isolationLevel
        const transaction = { kind: 'batch', id, index, isolationLevel, lock } as const
        return request.requestTransaction?.(transaction) ?? request
      })

      return waitForBatch(requests)
    }

    /**
     * Perform a long-running transaction
     * @param callback
     * @param options
     * @returns
     */
    async _transactionWithCallback({
      callback,
      options,
    }: {
      callback: (client: Client) => Promise<unknown>
      options?: Options
    }) {
      const headers = { traceparent: getTraceParent({ tracingConfig: this._tracingConfig }) }
      const info = await this._engine.transaction('start', headers, options as Options)

      let result: unknown
      try {
        // execute user logic with a proxied the client
        const transaction = { kind: 'itx', ...info } as const
        result = await callback(transactionProxy(this, transaction))

        // it went well, then we commit the transaction
        await this._engine.transaction('commit', headers, info)
      } catch (e: any) {
        // it went bad, then we rollback the transaction
        await this._engine.transaction('rollback', headers, info).catch(() => {})

        throw e // silent rollback, throw original error
      }

      return result
    }

    /**
     * Execute queries within a transaction
     * @param input a callback or a query list
     * @param options to set timeouts (callback)
     * @returns
     */
    $transaction(input: any, options?: any) {
      let callback: () => Promise<any>

      if (typeof input === 'function') {
        callback = () => this._transactionWithCallback({ callback: input, options })
      } else {
        callback = () => this._transactionWithArray({ promises: input, options })
      }

      const spanOptions = {
        name: 'transaction',
        enabled: this._tracingConfig.enabled,
        attributes: { method: '$transaction' },
      }

      return runInChildSpan(spanOptions, callback)
    }

    /**
     * Runs the middlewares over params before executing a request
     * @param internalParams
     * @returns
     */
    async _request(internalParams: InternalRequestParams): Promise<any> {
      // this is the otel context that is active at the callsite
      internalParams.otelParentCtx = context.active()

      // make sure that we don't leak extra properties to users
      const params: QueryMiddlewareParams = {
        args: internalParams.args,
        dataPath: internalParams.dataPath,
        runInTransaction: Boolean(internalParams.transaction),
        action: internalParams.action,
        model: internalParams.model,
      }

      // span options for opentelemetry instrumentation
      const spanOptions = {
        middleware: {
          name: 'middleware',
          enabled: this._tracingConfig.middleware,
          attributes: { method: '$use' },
          active: false,
        } as SpanOptions,
        operation: {
          name: 'operation',
          enabled: this._tracingConfig.enabled,
          attributes: {
            method: params.action,
            model: params.model,
            name: `${params.model}.${params.action}`,
          },
        } as SpanOptions,
      }

      let index = -1
      // prepare recursive fn that will pipe params through middlewares
      const consumer = (changedMiddlewareParams: QueryMiddlewareParams) => {
        // if this `next` was called and there's some more middlewares
        const nextMiddleware = this._middlewares.get(++index)

        if (nextMiddleware) {
          // we pass the modified params down to the next one, & repeat
          // calling `next` calls the consumer again with the new params
          return runInChildSpan(spanOptions.middleware, (span) => {
            // we call `span.end()` _before_ calling the next middleware
            return nextMiddleware(changedMiddlewareParams, (p) => (span?.end(), consumer(p)))
          })
        }

        // no middleware? then we just proceed with request execution
        // before we send the execution request, we use the changed params
        const { runInTransaction, ...changedRequestParams } = changedMiddlewareParams
        const requestParams = {
          ...internalParams,
          ...changedRequestParams,
        }

        // if middleware switched off `runInTransaction`, unset
        // `transaction` property on request as well so it will be executed outside
        // of transaction
        if (!runInTransaction) {
          requestParams.transaction = undefined
        }

        return applyQueryExtensions(this, requestParams) // also executes the query
      }

      return await runInChildSpan(spanOptions.operation, () => {
        if (NODE_CLIENT) {
          // https://github.com/prisma/prisma/issues/3148 not for edge client
          const asyncRes = new AsyncResource('prisma-client-request')
          return asyncRes.runInAsyncScope(() => consumer(params))
        }

        return consumer(params)
      })
    }

    async _executeRequest({
      args,
      clientMethod,
      dataPath,
      callsite,
      action,
      model,
      argsMapper,
      transaction,
      unpacker,
      otelParentCtx,
      customDataProxyFetch,
    }: InternalRequestParams) {
      try {
        const protocolEncoder = await this._getProtocolEncoder({ clientMethod, callsite })

        // execute argument transformation before execution
        args = argsMapper ? argsMapper(args) : args

        const spanOptions: SpanOptions = {
          name: 'serialize',
          enabled: this._tracingConfig.enabled,
        }

        let rejectOnNotFound: RejectOnNotFound
        if (model) {
          rejectOnNotFound = getRejectOnNotFound(action, model, args, this._rejectOnNotFound)
          warnAboutRejectOnNotFound(rejectOnNotFound, model, action)
        }

        const message = await runInChildSpan(spanOptions, () =>
          protocolEncoder.createMessage({
            modelName: model,
            action,
            args,
            clientMethod,
            callsite,
            extensions: this._extensions,
          }),
        )

        // as printJsonWithErrors takes a bit of compute
        // we only want to do it, if debug is enabled for 'prisma-client'
        if (Debug.enabled('prisma:client')) {
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
          debug(message.toDebugString() + '\n')
        }

        if (transaction?.kind === 'batch') {
          /** @see {@link getLockCountPromise} */
          await transaction.lock
        }

        return this._fetcher.request({
          protocolMessage: message,
          protocolEncoder,
          modelName: model,
          clientMethod,
          dataPath,
          rejectOnNotFound,
          callsite,
          args,
          extensions: this._extensions,
          transaction,
          unpacker,
          otelParentCtx,
          otelChildCtx: context.active(),
          customDataProxyFetch,
        })
      } catch (e) {
        e.clientVersion = this._clientVersion
        throw e
      }
    }

    _getDmmf = callOnce(async (params: Pick<InternalRequestParams, 'clientMethod' | 'callsite'>) => {
      try {
        const dmmf = await runInChildSpan(
          { name: 'getDmmf', enabled: this._tracingConfig.enabled, internal: true },
          () => this._engine.getDmmf(),
        )

        return runInChildSpan({ name: 'processDmmf', enabled: this._tracingConfig.enabled, internal: true }, () => {
          return new DMMFHelper(getPrismaClientDMMF(dmmf))
        })
      } catch (error) {
        this._fetcher.handleAndLogRequestError({ ...params, args: {}, error })
      }
    })

    _getProtocolEncoder = callOnce(
      async (params: Pick<InternalRequestParams, 'clientMethod' | 'callsite'>): Promise<ProtocolEncoder> => {
        if (this._engineConfig.engineProtocol === 'json') {
          return new JsonProtocolEncoder(this._baseDmmf, this._errorFormat)
        }

        if (this._dmmf === undefined) {
          this._dmmf = await this._getDmmf(params)
        }
        return new GraphQLProtocolEncoder(this._dmmf, this._errorFormat)
      },
    )

    get $metrics(): MetricsClient {
      if (!this._hasPreviewFlag('metrics')) {
        throw new PrismaClientValidationError(
          '`metrics` preview feature must be enabled in order to access metrics API',
        )
      }
      return this._metrics
    }

    /**
     * Shortcut for checking a preview flag
     * @param feature preview flag
     * @returns
     */
    _hasPreviewFlag(feature: string) {
      return !!this._engineConfig.previewFeatures?.includes(feature)
    }

    $extends = $extends
  }

  return PrismaClient
}

const forbidden: Array<string | symbol> = ['$connect', '$disconnect', '$on', '$transaction', '$use', '$extends']

/**
 * Proxy that takes over the client promises to pass `txId`
 * @param thing to be proxied
 * @param transaction to be passed down to {@link RequestHandler}
 * @returns
 */
function transactionProxy<T>(thing: T, transaction: PrismaPromiseInteractiveTransaction): T {
  // we only wrap within a proxy if it's possible: if it's an object
  if (typeof thing !== 'object') return thing

  return new Proxy(thing as any as object, {
    get: (target, prop) => {
      // we don't want to allow any calls to our `forbidden` methods
      if (forbidden.includes(prop as string)) return undefined

      if (prop === TX_ID) return transaction?.id // secret accessor to the txId

      // we override and handle every function call within the proxy
      if (typeof target[prop] === 'function') {
        return (...args: unknown[]) => {
          // we hijack promise calls to pass txId to prisma promises
          if (prop === 'then') return target[prop](args[0], args[1], transaction)
          if (prop === 'catch') return target[prop](args[0], transaction)
          if (prop === 'finally') return target[prop](args[0], transaction)

          // if it's not the end promise, result is also tx-proxied
          return transactionProxy(target[prop](...args), transaction)
        }
      }

      // if it's an object prop, then we keep on making it proxied
      return transactionProxy(target[prop], transaction)
    },

    has(target, prop) {
      if (forbidden.includes(prop)) {
        return false
      }
      return Reflect.has(target, prop)
    },
  }) as any as T
}

const rejectOnNotFoundReplacements = {
  findUnique: 'findUniqueOrThrow',
  findFirst: 'findFirstOrThrow',
}

function warnAboutRejectOnNotFound(
  rejectOnNotFound: RejectOnNotFound,
  model: string | undefined,
  action: string,
): void {
  if (rejectOnNotFound) {
    const replacementAction = rejectOnNotFoundReplacements[action]
    const replacementCall = model
      ? `prisma.${dmmfToJSModelName(model)}.${replacementAction}`
      : `prisma.${replacementAction}`
    const key = `rejectOnNotFound.${model ?? ''}.${action}`

    warnOnce(
      key,
      `\`rejectOnNotFound\` option is deprecated and will be removed in Prisma 5. Please use \`${replacementCall}\` method instead`,
    )
  }
}
