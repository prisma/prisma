import type { Context } from '@opentelemetry/api'
import Debug, { clearLogs } from '@prisma/debug'
import { bindAdapter, type DriverAdapter } from '@prisma/driver-adapter-utils'
import type { EnvValue, GeneratorConfig } from '@prisma/generator-helper'
import { ExtendedSpanOptions, logger, TracingHelper, tryLoadEnvs } from '@prisma/internals'
import type { LoadedEnv } from '@prisma/internals/dist/utils/tryLoadEnvs'
import { AsyncResource } from 'async_hooks'
import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import { RawValue, Sql } from 'sql-template-tag'

import { PrismaClientValidationError } from '.'
import { addProperty, createCompositeProxy, removeProperties } from './core/compositeProxy'
import { BatchTransactionOptions, Engine, EngineConfig, Fetch, Options } from './core/engines'
import { EngineEvent, LogEmitter } from './core/engines/common/types/Events'
import { prettyPrintArguments } from './core/errorRendering/prettyPrintArguments'
import { $extends } from './core/extensions/$extends'
import { applyAllResultExtensions } from './core/extensions/applyAllResultExtensions'
import { applyQueryExtensions } from './core/extensions/applyQueryExtensions'
import { MergedExtensionsList } from './core/extensions/MergedExtensionsList'
import { checkPlatformCaching } from './core/init/checkPlatformCaching'
import { getDatasourceOverrides } from './core/init/getDatasourceOverrides'
import { getEngineInstance } from './core/init/getEngineInstance'
import { getPreviewFeatures } from './core/init/getPreviewFeatures'
import { serializeJsonQuery } from './core/jsonProtocol/serializeJsonQuery'
import { MetricsClient } from './core/metrics/MetricsClient'
import {
  applyModelsAndClientExtensions,
  unApplyModelsAndClientExtensions,
} from './core/model/applyModelsAndClientExtensions'
import { rawCommandArgsMapper } from './core/raw-query/rawCommandArgsMapper'
import {
  checkAlter,
  rawQueryArgsMapper,
  sqlMiddlewareArgsMapper,
  templateStringMiddlewareArgsMapper,
} from './core/raw-query/rawQueryArgsMapper'
import { createPrismaPromiseFactory } from './core/request/createPrismaPromise'
import {
  PrismaPromise,
  PrismaPromiseInteractiveTransaction,
  PrismaPromiseTransaction,
} from './core/request/PrismaPromise'
import { UserArgs } from './core/request/UserArgs'
import { RuntimeDataModel } from './core/runtimeDataModel'
import { getTracingHelper } from './core/tracing/TracingHelper'
import { getLockCountPromise } from './core/transaction/utils/createLockCountPromise'
import { itxClientDenyList } from './core/types/exported/itxClientDenyList'
import { JsInputValue } from './core/types/exported/JsApi'
import { RawQueryArgs } from './core/types/exported/RawQueryArgs'
import { getLogLevel } from './getLogLevel'
import type { QueryMiddleware, QueryMiddlewareParams } from './MiddlewareHandler'
import { MiddlewareHandler } from './MiddlewareHandler'
import { RequestHandler } from './RequestHandler'
import { CallSite, getCallSite } from './utils/CallSite'
import { clientVersion } from './utils/clientVersion'
import { deserializeRawResults } from './utils/deserializeRawResults'
import { validatePrismaClientOptions } from './utils/validatePrismaClientOptions'
import { waitForBatch } from './utils/waitForBatch'

const debug = Debug('prisma:client')

declare global {
  // eslint-disable-next-line no-var
  var NODE_CLIENT: true
  const TARGET_ENGINE_TYPE: 'binary' | 'library' | 'edge'
}

// used by esbuild for tree-shaking
typeof globalThis === 'object' ? (globalThis.NODE_CLIENT = true) : 0

export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'

export type Datasource = {
  url?: string
}
export type Datasources = { [name in string]: Datasource }

export type PrismaClientOptions = {
  /**
   * Overwrites the primary datasource url from your schema.prisma file
   */
  datasourceUrl?: string
  /**
   * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale.
   */
  adapter?: DriverAdapter

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

  /** Used to convert args for middleware and back */
  middlewareArgsMapper?: MiddlewareArgsMapper<unknown, unknown>
  /** Used for Accelerate client extension via Data Proxy */
  customDataProxyFetch?: (fetch: Fetch) => Fetch
} & Omit<QueryMiddlewareParams, 'runInTransaction'>

export type MiddlewareArgsMapper<RequestArgs, MiddlewareArgs> = {
  requestArgsToMiddlewareArgs(requestArgs: RequestArgs): MiddlewareArgs
  middlewareArgsToRequestArgs(middlewareArgs: MiddlewareArgs): RequestArgs
}

const noopMiddlewareArgsMapper: MiddlewareArgsMapper<unknown, unknown> = {
  requestArgsToMiddlewareArgs: (param) => param,
  middlewareArgsToRequestArgs: (param) => param,
}

/* Types for Logging */
export type LogLevel = 'info' | 'query' | 'warn' | 'error'
export type LogDefinition = {
  level: LogLevel
  emit: 'stdout' | 'event'
}

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

type ExtendedEventType = LogLevel | 'beforeExit'
type EventCallback<E extends ExtendedEventType> = [E] extends ['beforeExit']
  ? () => Promise<void>
  : [E] extends [LogLevel]
  ? (event: EngineEvent<E>) => void
  : never

/**
 * Config that is stored into the generated client. When the generated client is
 * loaded, this same config is passed to {@link getPrismaClient} which creates a
 * closure with that config around a non-instantiated [[PrismaClient]].
 */
export type GetPrismaClientConfig = {
  // Case for normal client (with both protocols) or data proxy
  // client (with json protocol): only runtime datamodel is provided,
  // full DMMF document is not
  runtimeDataModel: RuntimeDataModel
  generator?: GeneratorConfig
  relativeEnvPaths: {
    rootEnvPath?: string | null
    schemaEnvPath?: string | null
  }
  relativePath: string
  dirname: string
  filename?: string
  clientVersion: string
  engineVersion: string
  datasourceNames: string[]
  activeProvider: string

  /**
   * The contents of the schema encoded into a string
   * @remarks only used for the purpose of data proxy
   */
  inlineSchema: string

  /**
   * A special env object just for the data proxy edge runtime.
   * Allows bundlers to inject their own env variables (Vercel).
   * Allows platforms to declare global variables as env (Workers).
   * @remarks only used for the purpose of data proxy
   */
  injectableEdgeEnv?: () => LoadedEnv

  /**
   * The contents of the datasource url saved in a string.
   * This can either be an env var name or connection string.
   * It is needed by the client to connect to the Data Proxy.
   * @remarks only used for the purpose of data proxy
   */
  inlineDatasources: { [name in string]: { url: EnvValue } }

  /**
   * The string hash that was produced for a given schema
   * @remarks only used for the purpose of data proxy
   */
  inlineSchemaHash: string

  /**
   * A marker to indicate that the client was not generated via `prisma
   * generate` but was generated via `generate --postinstall` script instead.
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

  /**
   * Information about whether we have not found a schema.prisma file in the
   * default location, and that we fell back to finding the schema.prisma file
   * in the current working directory. This usually means it has been bundled.
   */
  isBundled?: boolean

  /**
   * A boolean that is `true` when the client was generated with --no-engine. At
   * runtime, this means the client will be bound to be using the Data Proxy.
   */
  noEngine?: boolean
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
    _runtimeDataModel: RuntimeDataModel
    _requestHandler: RequestHandler
    _connectionPromise?: Promise<any>
    _disconnectionPromise?: Promise<any>
    _engineConfig: EngineConfig
    _clientVersion: string
    _errorFormat: ErrorFormat
    _tracingHelper: TracingHelper
    _metrics: MetricsClient
    _middlewares = new MiddlewareHandler<QueryMiddleware>()
    _previewFeatures: string[]
    _activeProvider: string
    _extensions: MergedExtensionsList
    _engine: Engine
    /**
     * A fully constructed/applied Client that references the parent
     * PrismaClient. This is used for Client extensions only.
     */
    _appliedParent: PrismaClient
    _createPrismaPromise = createPrismaPromiseFactory()

    constructor(optionsArg?: PrismaClientOptions) {
      checkPlatformCaching(config)

      if (optionsArg) {
        validatePrismaClientOptions(optionsArg, config)
      }

      const adapter = optionsArg?.adapter ? bindAdapter(optionsArg.adapter) : undefined
      const logEmitter = new EventEmitter().on('error', () => {
        // this is a no-op to prevent unhandled error events
        //
        // If the user enabled error logging this would never be executed. If the user did not
        // enabled error logging, this would be executed, and a trace for the error would be logged
        // in debug mode, which is like going in the opposite direction than what the user wanted by
        // not enabling error logging in the first place.
      }) as LogEmitter

      this._extensions = MergedExtensionsList.empty()
      this._previewFeatures = getPreviewFeatures(config)
      this._clientVersion = config.clientVersion ?? clientVersion
      this._activeProvider = config.activeProvider
      this._tracingHelper = getTracingHelper(this._previewFeatures)
      const envPaths = {
        rootEnvPath:
          config.relativeEnvPaths.rootEnvPath && path.resolve(config.dirname, config.relativeEnvPaths.rootEnvPath),
        schemaEnvPath:
          config.relativeEnvPaths.schemaEnvPath && path.resolve(config.dirname, config.relativeEnvPaths.schemaEnvPath),
      }

      const loadedEnv = // for node we load the env from files, for edge only via env injections
        (NODE_CLIENT && !adapter && tryLoadEnvs(envPaths, { conflictCheck: 'none' })) || config.injectableEdgeEnv?.()

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

        this._runtimeDataModel = config.runtimeDataModel

        this._engineConfig = {
          cwd,
          dirname: config.dirname,
          enableDebugLogs: useDebug,
          allowTriggerPanic: engineConfig.allowTriggerPanic,
          datamodelPath: path.join(config.dirname, config.filename ?? 'schema.prisma'),
          prismaPath: engineConfig.binaryPath ?? undefined,
          engineEndpoint: engineConfig.endpoint,
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
          env: loadedEnv?.parsed ?? {},
          flags: [],
          clientVersion: config.clientVersion,
          engineVersion: config.engineVersion,
          previewFeatures: this._previewFeatures,
          activeProvider: config.activeProvider,
          inlineSchema: config.inlineSchema,
          overrideDatasources: getDatasourceOverrides(options, config.datasourceNames),
          inlineDatasources: config.inlineDatasources,
          inlineSchemaHash: config.inlineSchemaHash,
          tracingHelper: this._tracingHelper,
          logEmitter,
          isBundled: config.isBundled,
          adapter,
        }

        debug('clientVersion', config.clientVersion)

        this._engine = getEngineInstance(config, this._engineConfig)
        this._requestHandler = new RequestHandler(this, logEmitter)

        if (options.log) {
          for (const log of options.log) {
            const level = typeof log === 'string' ? log : log.emit === 'stdout' ? log.level : null
            if (level) {
              this.$on(level, (event) => {
                logger.log(`${logger.tags[level] ?? ''}`, (event as LogEvent).message || (event as QueryEvent).query)
              })
            }
          }
        }

        this._metrics = new MetricsClient(this._engine)
      } catch (e: any) {
        e.clientVersion = this._clientVersion
        throw e
      }

      // the first client has no parent so it is its own parent client
      // this is used for extensions to reference their parent client
      return (this._appliedParent = applyModelsAndClientExtensions(this))
      // this applied client is also a custom constructor return value
    }
    get [Symbol.toStringTag]() {
      return 'PrismaClient'
    }

    /**
     * Hook a middleware into the client
     * @param middleware to hook
     */
    $use(middleware: QueryMiddleware) {
      this._middlewares.use(middleware)
    }

    $on<E extends ExtendedEventType>(eventType: E, callback: EventCallback<E>) {
      if (eventType === 'beforeExit') {
        this._engine.onBeforeExit(callback as EventCallback<'beforeExit'>)
      } else if (eventType) {
        this._engineConfig.logEmitter.on(eventType, callback as EventCallback<LogLevel>)
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
     * Disconnect from the database
     */
    async $disconnect() {
      try {
        await this._engine.stop()
      } catch (e: any) {
        e.clientVersion = this._clientVersion
        throw e
      } finally {
        // Debug module keeps a list of last 100 logs regardless of environment
        // variables. This can cause a memory leak. It's especially bad in jest
        // environment where keeping an error in this list prevents jest sandbox
        // from being GCed. Clearing logs on disconnect helps to avoid that
        clearLogs()
      }
    }

    /**
     * Executes a raw query and always returns a number
     */
    $executeRawInternal(
      transaction: PrismaPromiseTransaction | undefined,
      clientMethod: string,
      args: RawQueryArgs,
      middlewareArgsMapper?: MiddlewareArgsMapper<unknown, unknown>,
    ): Promise<number> {
      const activeProvider = this._activeProvider
      const activeProviderFlavour = this._engineConfig.adapter?.flavour

      return this._request({
        action: 'executeRaw',
        args,
        transaction,
        clientMethod,
        argsMapper: rawQueryArgsMapper({ clientMethod, activeProvider, activeProviderFlavour }),
        callsite: getCallSite(this._errorFormat),
        dataPath: [],
        middlewareArgsMapper,
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
      return this._createPrismaPromise((transaction) => {
        if ((query as TemplateStringsArray).raw !== undefined || (query as Sql).sql !== undefined) {
          const [sql, argsMapper] = toSql(query, values)
          checkAlter(
            this._activeProvider,
            sql.text,
            sql.values,
            Array.isArray(query) ? 'prisma.$executeRaw`<SQL>`' : 'prisma.$executeRaw(sql`<SQL>`)',
          )
          return this.$executeRawInternal(transaction, '$executeRaw', sql, argsMapper)
        }

        throw new PrismaClientValidationError(
          `\`$executeRaw\` is a tag function, please use it like the following:
\`\`\`
const result = await prisma.$executeRaw\`UPDATE User SET cool = \${true} WHERE email = \${'user@email.com'};\`
\`\`\`

Or read our docs at https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access#executeraw
`,
          { clientVersion: this._clientVersion },
        )
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
      return this._createPrismaPromise((transaction) => {
        checkAlter(this._activeProvider, query, values, 'prisma.$executeRawUnsafe(<SQL>, [...values])')
        return this.$executeRawInternal(transaction, '$executeRawUnsafe', [query, ...values])
      })
    }

    /**
     * Executes a raw command only for MongoDB
     *
     * @param command
     * @returns
     */
    $runCommandRaw(command: Record<string, JsInputValue>) {
      if (config.activeProvider !== 'mongodb') {
        throw new PrismaClientValidationError(
          `The ${config.activeProvider} provider does not support $runCommandRaw. Use the mongodb provider.`,
          { clientVersion: this._clientVersion },
        )
      }

      return this._createPrismaPromise((transaction) => {
        return this._request({
          args: command,
          clientMethod: '$runCommandRaw',
          dataPath: [],
          action: 'runCommandRaw',
          argsMapper: rawCommandArgsMapper,
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
      middlewareArgsMapper?: MiddlewareArgsMapper<unknown, unknown>,
    ) {
      const activeProvider = this._activeProvider
      const activeProviderFlavour = this._engineConfig.adapter?.flavour

      return this._request({
        action: 'queryRaw',
        args,
        transaction,
        clientMethod,
        argsMapper: rawQueryArgsMapper({ clientMethod, activeProvider, activeProviderFlavour }),
        callsite: getCallSite(this._errorFormat),
        dataPath: [],
        middlewareArgsMapper,
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
      return this._createPrismaPromise((transaction) => {
        if ((query as TemplateStringsArray).raw !== undefined || (query as Sql).sql !== undefined) {
          return this.$queryRawInternal(transaction, '$queryRaw', ...toSql(query, values))
        }

        throw new PrismaClientValidationError(
          `\`$queryRaw\` is a tag function, please use it like the following:
\`\`\`
const result = await prisma.$queryRaw\`SELECT * FROM User WHERE id = \${1} OR email = \${'user@email.com'};\`
\`\`\`

Or read our docs at https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access#queryraw
`,
          { clientVersion: this._clientVersion },
        )
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
      return this._createPrismaPromise((transaction) => {
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
      const headers = { traceparent: this._tracingHelper.getTraceParent() }
      const info = await this._engine.transaction('start', headers, options as Options)

      let result: unknown
      try {
        // execute user logic with a proxied the client
        const transaction = { kind: 'itx', ...info } as const

        result = await callback(this._createItxClient(transaction))

        // it went well, then we commit the transaction
        await this._engine.transaction('commit', headers, info)
      } catch (e: any) {
        // it went bad, then we rollback the transaction
        await this._engine.transaction('rollback', headers, info).catch(() => {})

        throw e // silent rollback, throw original error
      }

      return result
    }

    _createItxClient(transaction: PrismaPromiseInteractiveTransaction): Client {
      return applyModelsAndClientExtensions(
        createCompositeProxy(unApplyModelsAndClientExtensions(this), [
          addProperty('_appliedParent', () => this._appliedParent._createItxClient(transaction)),
          addProperty('_createPrismaPromise', () => createPrismaPromiseFactory(transaction)),
          addProperty(TX_ID, () => transaction.id),
          removeProperties(itxClientDenyList),
        ]),
      )
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
        attributes: { method: '$transaction' },
      }

      return this._tracingHelper.runInChildSpan(spanOptions, callback)
    }

    /**
     * Runs the middlewares over params before executing a request
     * @param internalParams
     * @returns
     */
    _request(internalParams: InternalRequestParams): Promise<any> {
      // this is the otel context that is active at the callsite
      internalParams.otelParentCtx = this._tracingHelper.getActiveContext()
      const middlewareArgsMapper = internalParams.middlewareArgsMapper ?? noopMiddlewareArgsMapper

      // make sure that we don't leak extra properties to users
      const params: QueryMiddlewareParams = {
        args: middlewareArgsMapper.requestArgsToMiddlewareArgs(internalParams.args),
        dataPath: internalParams.dataPath,
        runInTransaction: Boolean(internalParams.transaction),
        action: internalParams.action,
        model: internalParams.model,
      }

      // span options for opentelemetry instrumentation
      const spanOptions = {
        middleware: {
          name: 'middleware',
          middleware: true,
          attributes: { method: '$use' },
          active: false,
        } as ExtendedSpanOptions,
        operation: {
          name: 'operation',
          attributes: {
            method: params.action,
            model: params.model,
            name: params.model ? `${params.model}.${params.action}` : params.action,
          },
        } as ExtendedSpanOptions,
      }

      let index = -1
      // prepare recursive fn that will pipe params through middlewares
      const consumer = async (changedMiddlewareParams: QueryMiddlewareParams) => {
        // if this `next` was called and there's some more middlewares
        const nextMiddleware = this._middlewares.get(++index)

        if (nextMiddleware) {
          // we pass the modified params down to the next one, & repeat
          // calling `next` calls the consumer again with the new params
          return this._tracingHelper.runInChildSpan(spanOptions.middleware, (span) => {
            // we call `span.end()` _before_ calling the next middleware
            return nextMiddleware(changedMiddlewareParams, (p) => (span?.end(), consumer(p)))
          })
        }

        // no middleware? then we just proceed with request execution
        // before we send the execution request, we use the changed params
        const { runInTransaction, args, ...changedRequestParams } = changedMiddlewareParams
        const requestParams = {
          ...internalParams,
          ...changedRequestParams,
        }

        if (args) {
          requestParams.args = middlewareArgsMapper.middlewareArgsToRequestArgs(args)
        }

        // if middleware switched off `runInTransaction`, unset `transaction`
        // property on request as well so it will be executed outside of the tx
        if (internalParams.transaction !== undefined && runInTransaction === false) {
          delete requestParams.transaction // client extensions check for this
        }

        const result = await applyQueryExtensions(this, requestParams) // also executes the query
        if (!requestParams.model) {
          return result
        }
        return applyAllResultExtensions({
          result,
          modelName: requestParams.model,
          args: requestParams.args,
          extensions: this._extensions,
          runtimeDataModel: this._runtimeDataModel,
        })
      }

      return this._tracingHelper.runInChildSpan(spanOptions.operation, () => {
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
        // execute argument transformation before execution
        args = argsMapper ? argsMapper(args) : args

        const spanOptions: ExtendedSpanOptions = {
          name: 'serialize',
        }

        const message = this._tracingHelper.runInChildSpan(spanOptions, () =>
          serializeJsonQuery({
            modelName: model,
            runtimeDataModel: this._runtimeDataModel,
            action,
            args,
            clientMethod,
            callsite,
            extensions: this._extensions,
            errorFormat: this._errorFormat,
            clientVersion: this._clientVersion,
          }),
        )

        // as prettyPrintArguments takes a bit of compute
        // we only want to do it, if debug is enabled for 'prisma-client'
        if (Debug.enabled('prisma:client')) {
          debug(`Prisma Client call:`)
          debug(`prisma.${clientMethod}(${prettyPrintArguments(args)})`)
          debug(`Generated request:`)
          debug(JSON.stringify(message, null, 2) + '\n')
        }

        if (transaction?.kind === 'batch') {
          /** @see {@link getLockCountPromise} */
          await transaction.lock
        }

        return this._requestHandler.request({
          protocolQuery: message,
          modelName: model,
          action,
          clientMethod,
          dataPath,
          callsite,
          args,
          extensions: this._extensions,
          transaction,
          unpacker,
          otelParentCtx,
          otelChildCtx: this._tracingHelper.getActiveContext(),
          customDataProxyFetch,
        })
      } catch (e) {
        e.clientVersion = this._clientVersion
        throw e
      }
    }

    get $metrics(): MetricsClient {
      if (!this._hasPreviewFlag('metrics')) {
        throw new PrismaClientValidationError(
          '`metrics` preview feature must be enabled in order to access metrics API',
          { clientVersion: this._clientVersion },
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

function toSql(query: TemplateStringsArray | Sql, values: unknown[]): [Sql, MiddlewareArgsMapper<unknown, unknown>] {
  if (isTemplateStringArray(query)) {
    return [new Sql(query, values), templateStringMiddlewareArgsMapper]
  }

  return [query, sqlMiddlewareArgsMapper]
}

function isTemplateStringArray(value: unknown): value is TemplateStringsArray {
  return Array.isArray(value) && Array.isArray(value['raw'])
}
