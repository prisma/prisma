import Debug from '@prisma/debug'
import { type ErrorCapturingDriverAdapter } from '@prisma/driver-adapter-utils'
import type { BinaryTarget } from '@prisma/get-platform'
import { assertNodeAPISupported, binaryTargets, getBinaryTargetForCurrentPlatform } from '@prisma/get-platform'
import { EngineTrace, TracingHelper } from '@prisma/internals'
import { bold, green, red } from 'kleur/colors'

import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { PrismaClientRustPanicError } from '../../errors/PrismaClientRustPanicError'
import { PrismaClientUnknownRequestError } from '../../errors/PrismaClientUnknownRequestError'
import { QueryInterpreter } from '../../interpreter/QueryInterpreter'
import type {
  BatchQueryEngineResult,
  EngineConfig,
  QueryPlanNode,
  RequestBatchOptions,
  RequestOptions,
} from '../common/Engine'
import { Engine } from '../common/Engine'
import { LogEmitter, LogEventType } from '../common/types/Events'
import { JsonQuery } from '../common/types/JsonProtocol'
import { EngineMetricsOptions, Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from '../common/types/Metrics'
import type {
  QueryEngineEvent,
  QueryEngineLogLevel,
  QueryEnginePanicEvent,
  QueryEngineQueryEvent,
  RustRequestError,
  SyncRustError,
} from '../common/types/QueryEngine'
import type * as Tx from '../common/types/Transaction'
import { getErrorMessageWithLink as genericGetErrorMessageWithLink } from '../common/utils/getErrorMessageWithLink'
import { defaultLibraryLoader } from '../library/DefaultLibraryLoader'
import { reactNativeLibraryLoader } from '../library/ReactNativeLibraryLoader'
import type { Library, LibraryLoader, QueryEngineConstructor, QueryEngineInstance } from '../library/types/Library'
import { wasmLibraryLoader } from '../library/WasmLibraryLoader'

const CLIENT_ENGINE_ERROR = 'P2038'

const debug = Debug('prisma:client:libraryEngine')

function isQueryEvent(event: QueryEngineEvent): event is QueryEngineQueryEvent {
  return event['item_type'] === 'query' && 'query' in event
}
function isPanicEvent(event: QueryEngineEvent): event is QueryEnginePanicEvent {
  if ('level' in event) {
    return event.level === 'error' && event['message'] === 'PANIC'
  } else {
    return false
  }
}

const knownBinaryTargets: BinaryTarget[] = [...binaryTargets, 'native']

const MAX_REQUEST_ID = 0xffffffffffffffffn
let NEXT_REQUEST_ID = 1n

function nextRequestId(): bigint {
  const requestId = NEXT_REQUEST_ID++
  if (NEXT_REQUEST_ID > MAX_REQUEST_ID) {
    NEXT_REQUEST_ID = 1n
  }
  return requestId
}

export class ClientEngine implements Engine<undefined> {
  name = 'ClientEngine' as const
  engine?: ReturnType<typeof this.wrapEngine>
  libraryInstantiationPromise?: Promise<void>
  libraryStartingPromise?: Promise<void>
  libraryStoppingPromise?: Promise<void>
  libraryStarted: boolean
  executingQueryPromise?: Promise<any>
  config: EngineConfig
  QueryEngineConstructor?: QueryEngineConstructor
  libraryLoader: LibraryLoader
  library?: Library
  driverAdapter: ErrorCapturingDriverAdapter
  logEmitter: LogEmitter
  libQueryEnginePath?: string
  binaryTarget?: BinaryTarget
  datasourceOverrides?: Record<string, string>
  datamodel: string
  logQueries: boolean
  logLevel: QueryEngineLogLevel
  lastQuery?: string
  loggerRustPanic?: any
  tracingHelper: TracingHelper

  versionInfo?: {
    commit: string
    version: string
  }

  constructor(config: EngineConfig, libraryLoader?: LibraryLoader) {
    if (!config.previewFeatures?.includes('driverAdapters')) {
      throw new PrismaClientInitializationError(
        'EngineType `client` requires the driverAdapters preview feature to be enabled.',
        config.clientVersion!,
        CLIENT_ENGINE_ERROR,
      )
    }
    const { adapter } = config
    if (!adapter) {
      throw new PrismaClientInitializationError(
        'Missing configured driver adapter. Engine type `client` requires an active driver adapter. Please check your PrismaClient initialization code.',
        config.clientVersion!,
        CLIENT_ENGINE_ERROR,
      )
    } else {
      this.driverAdapter = adapter
      debug('Using driver adapter: %O', adapter)
    }

    if (TARGET_BUILD_TYPE === 'react-native') {
      this.libraryLoader = reactNativeLibraryLoader
    } else if (TARGET_BUILD_TYPE === 'library') {
      this.libraryLoader = libraryLoader ?? defaultLibraryLoader

      // this can only be true if PRISMA_CLIENT_FORCE_WASM=true
      if (config.engineWasm !== undefined) {
        this.libraryLoader = libraryLoader ?? wasmLibraryLoader
      }
    } else if (TARGET_BUILD_TYPE === 'wasm') {
      this.libraryLoader = libraryLoader ?? wasmLibraryLoader
    } else {
      throw new Error(`Invalid TARGET_BUILD_TYPE: ${TARGET_BUILD_TYPE}`)
    }

    this.config = config
    this.libraryStarted = false
    this.logQueries = config.logQueries ?? false
    this.logLevel = config.logLevel ?? 'error'
    this.logEmitter = config.logEmitter
    this.datamodel = config.inlineSchema
    this.tracingHelper = config.tracingHelper

    if (config.enableDebugLogs) {
      this.logLevel = 'debug'
    }

    // compute the datasource override for library engine
    const dsOverrideName = Object.keys(config.overrideDatasources)[0]
    const dsOverrideUrl = config.overrideDatasources[dsOverrideName]?.url
    if (dsOverrideName !== undefined && dsOverrideUrl !== undefined) {
      this.datasourceOverrides = { [dsOverrideName]: dsOverrideUrl }
    }

    this.libraryInstantiationPromise = this.instantiateLibrary()
  }

  private wrapEngine(engine: QueryEngineInstance) {
    return {
      applyPendingMigrations: engine.applyPendingMigrations?.bind(engine),
      commitTransaction: this.withRequestId(engine.commitTransaction.bind(engine)),
      connect: this.withRequestId(engine.connect.bind(engine)),
      disconnect: this.withRequestId(engine.disconnect.bind(engine)),
      metrics: engine.metrics?.bind(engine),
      query: this.withRequestId(engine.query.bind(engine)),
      rollbackTransaction: this.withRequestId(engine.rollbackTransaction.bind(engine)),
      sdlSchema: engine.sdlSchema?.bind(engine),
      startTransaction: this.withRequestId(engine.startTransaction.bind(engine)),
      trace: engine.trace.bind(engine),
      compile: engine.compile.bind(engine),
    }
  }

  private withRequestId<T extends unknown[], U>(
    fn: (...args: [...T, string]) => Promise<U>,
  ): (...args: T) => Promise<U> {
    return async (...args) => {
      const requestId = nextRequestId().toString()
      try {
        return await fn(...args, requestId)
      } finally {
        if (this.tracingHelper.isEnabled()) {
          const traceJson = await this.engine?.trace(requestId)
          if (traceJson) {
            const trace = JSON.parse(traceJson) as EngineTrace
            this.tracingHelper.dispatchEngineSpans(trace.spans)
          }
        }
      }
    }
  }

  async applyPendingMigrations(): Promise<void> {
    if (TARGET_BUILD_TYPE === 'react-native') {
      await this.start()
      await this.engine?.applyPendingMigrations!()
    } else {
      throw new Error('Cannot call this method from this type of engine instance')
    }
  }

  async transaction(
    action: 'start',
    headers: Tx.TransactionHeaders,
    options: Tx.Options,
  ): Promise<Tx.InteractiveTransactionInfo<undefined>>
  async transaction(
    action: 'commit',
    headers: Tx.TransactionHeaders,
    info: Tx.InteractiveTransactionInfo<undefined>,
  ): Promise<undefined>
  async transaction(
    action: 'rollback',
    headers: Tx.TransactionHeaders,
    info: Tx.InteractiveTransactionInfo<undefined>,
  ): Promise<undefined>
  transaction(
    _action: any,
    _headers: Tx.TransactionHeaders,
    _arg?: any,
  ): Promise<Tx.InteractiveTransactionInfo<undefined> | undefined> {
    throw new Error('Method not implemented.')
  }

  private async instantiateLibrary(): Promise<void> {
    debug('internalSetup')
    if (this.libraryInstantiationPromise) {
      return this.libraryInstantiationPromise
    }

    if (TARGET_BUILD_TYPE === 'library') {
      assertNodeAPISupported()
    }

    this.binaryTarget = await this.getCurrentBinaryTarget()

    await this.tracingHelper.runInChildSpan('load_engine', () => this.loadEngine())

    this.version()
  }

  private async getCurrentBinaryTarget() {
    if (TARGET_BUILD_TYPE === 'library') {
      if (this.binaryTarget) return this.binaryTarget
      const binaryTarget = await this.tracingHelper.runInChildSpan('detect_platform', () =>
        getBinaryTargetForCurrentPlatform(),
      )
      if (!knownBinaryTargets.includes(binaryTarget)) {
        throw new PrismaClientInitializationError(
          `Unknown ${red('PRISMA_QUERY_ENGINE_LIBRARY')} ${red(bold(binaryTarget))}. Possible binaryTargets: ${green(
            knownBinaryTargets.join(', '),
          )} or a path to the query engine library.
You may have to run ${green('prisma generate')} for your changes to take effect.`,
          this.config.clientVersion!,
        )
      }

      return binaryTarget
    }

    return undefined
  }

  private parseEngineResponse<T>(response?: string): T {
    if (!response) {
      throw new PrismaClientUnknownRequestError(`Response from the Engine was empty`, {
        clientVersion: this.config.clientVersion!,
      })
    }

    try {
      return JSON.parse(response) as T
    } catch (err) {
      throw new PrismaClientUnknownRequestError(`Unable to JSON.parse response from engine`, {
        clientVersion: this.config.clientVersion!,
      })
    }
  }

  private async loadEngine(): Promise<void> {
    if (this.engine) {
      return
    }

    if (!this.QueryEngineConstructor) {
      this.library = await this.libraryLoader.loadLibrary(this.config)
      this.QueryEngineConstructor = this.library.QueryEngine
    }

    try {
      // Using strong reference to `this` inside of log callback will prevent
      // this instance from being GCed while native engine is alive. At the
      // same time, `this.engine` field will prevent native instance from
      // being GCed. Using weak ref helps to avoid this cycle
      const weakThis = new WeakRef(this)
      this.engine = this.wrapEngine(
        new this.QueryEngineConstructor(
          {
            datamodel: this.datamodel,
            env: process.env,
            logQueries: this.config.logQueries ?? false,
            ignoreEnvVarErrors: true,
            datasourceOverrides: this.datasourceOverrides ?? {},
            logLevel: this.logLevel,
            configDir: this.config.cwd,
            engineProtocol: 'json',
            enableTracing: this.tracingHelper.isEnabled(),
          },
          (log) => {
            weakThis.deref()?.logger(log)
          },
          this.driverAdapter,
        ),
      )
    } catch (_e) {
      const e = _e as Error
      const error = this.parseInitError(e.message)
      if (typeof error === 'string') {
        throw e
      } else {
        throw new PrismaClientInitializationError(error.message, this.config.clientVersion!, error.error_code)
      }
    }
  }

  private logger(log: string) {
    const event = this.parseEngineResponse<QueryEngineEvent | null>(log)
    if (!event) return

    event.level = event?.level.toLowerCase() ?? 'unknown'
    if (isQueryEvent(event)) {
      this.logEmitter.emit('query', {
        timestamp: new Date(),
        query: event.query,
        params: event.params,
        duration: Number(event.duration_ms),
        target: event.module_path,
      })
    } else if (isPanicEvent(event) && TARGET_BUILD_TYPE !== 'wasm') {
      // The error built is saved to be thrown later
      this.loggerRustPanic = new PrismaClientRustPanicError(
        getErrorMessageWithLink(
          this,
          `${event.message}: ${event.reason} in ${event.file}:${event.line}:${event.column}`,
        ),
        this.config.clientVersion!,
      )
    } else {
      this.logEmitter.emit(event.level as LogEventType, {
        timestamp: new Date(),
        message: event.message,
        target: event.module_path,
      })
    }
  }

  private parseInitError(str: string): SyncRustError | string {
    try {
      const error = JSON.parse(str)
      return error
    } catch (e) {
      //
    }
    return str
  }

  private parseRequestError(str: string): RustRequestError | string {
    try {
      const error = JSON.parse(str)
      return error
    } catch (e) {
      //
    }
    return str
  }

  onBeforeExit() {
    throw new Error(
      '"beforeExit" hook is not applicable to the library engine since Prisma 5.0.0, it is only relevant and implemented for the binary engine. Please add your event listener to the `process` object directly instead.',
    )
  }

  async start(): Promise<void> {
    await this.libraryInstantiationPromise
    await this.libraryStoppingPromise

    if (this.libraryStartingPromise) {
      debug(`library already starting, this.libraryStarted: ${this.libraryStarted}`)
      return this.libraryStartingPromise
    }

    if (this.libraryStarted) {
      return
    }

    const startFn = async () => {
      debug('library starting')

      try {
        const headers = {
          traceparent: this.tracingHelper.getTraceParent(),
        }

        await this.engine?.connect(JSON.stringify(headers))

        this.libraryStarted = true

        debug('library started')
      } catch (err) {
        const error = this.parseInitError(err.message as string)

        // The error message thrown by the query engine should be a stringified JSON
        // if parsing fails then we just reject the error
        if (typeof error === 'string') {
          throw err
        } else {
          throw new PrismaClientInitializationError(error.message, this.config.clientVersion!, error.error_code)
        }
      } finally {
        this.libraryStartingPromise = undefined
      }
    }

    this.libraryStartingPromise = this.tracingHelper.runInChildSpan('connect', startFn)

    return this.libraryStartingPromise
  }

  async stop(): Promise<void> {
    await this.libraryStartingPromise
    await this.executingQueryPromise

    if (this.libraryStoppingPromise) {
      debug('library is already stopping')
      return this.libraryStoppingPromise
    }

    if (!this.libraryStarted) {
      return
    }

    const stopFn = async () => {
      await new Promise((r) => setTimeout(r, 5))

      debug('library stopping')

      const headers = {
        traceparent: this.tracingHelper.getTraceParent(),
      }

      await this.engine?.disconnect(JSON.stringify(headers))

      this.libraryStarted = false
      this.libraryStoppingPromise = undefined

      debug('library stopped')
    }

    this.libraryStoppingPromise = this.tracingHelper.runInChildSpan('disconnect', stopFn)

    return this.libraryStoppingPromise
  }

  version(): string {
    this.versionInfo = this.library?.version()
    return this.versionInfo?.version ?? 'unknown'
  }
  /**
   * Triggers an artificial panic
   */
  debugPanic(message?: string): Promise<never> {
    return this.library?.debugPanic(message) as Promise<never>
  }

  async request<T>(
    query: JsonQuery,
    // TODO: support traceparent and interactiveTransaction!
    { traceparent: _traceparent, interactiveTransaction: _interactiveTransaction }: RequestOptions<undefined>,
  ): Promise<{ data: T }> {
    debug(`sending request, this.libraryStarted: ${this.libraryStarted}`)
    const queryStr = JSON.stringify(query)

    try {
      await this.start()

      const queryPlanString = await this.engine!.compile(queryStr, false)
      const queryPlan: QueryPlanNode = JSON.parse(queryPlanString)

      debug(`query plan created: ${queryPlanString}`)

      // TODO: actually support the usage of `Prisma.Param` to reuse compiled queries with different values
      const placeholderValues = {}
      const interpreter = new QueryInterpreter(this.driverAdapter, placeholderValues)
      const result = await interpreter.run(queryPlan)

      debug(`query plan executed`)

      return { data: { [query.action]: result } as T }
    } catch (e: any) {
      if (e instanceof PrismaClientInitializationError) {
        throw e
      }
      if (e.code === 'GenericFailure' && e.message?.startsWith('PANIC:') && TARGET_BUILD_TYPE !== 'wasm') {
        throw new PrismaClientRustPanicError(getErrorMessageWithLink(this, e.message), this.config.clientVersion!)
      }
      const error = this.parseRequestError(e.message)
      if (typeof error === 'string') {
        throw e
      } else {
        throw new PrismaClientUnknownRequestError(`${error.message}\n${error.backtrace}`, {
          clientVersion: this.config.clientVersion!,
        })
      }
    }
  }

  requestBatch<T>(
    _queries: JsonQuery[],
    { transaction: _transaction, traceparent: _traceparent }: RequestBatchOptions<undefined>,
  ): Promise<BatchQueryEngineResult<T>[]> {
    debug('requestBatch')
    throw new Error('Method not implemented.')
  }

  async metrics(options: MetricsOptionsJson): Promise<Metrics>
  async metrics(options: MetricsOptionsPrometheus): Promise<string>
  async metrics(options: EngineMetricsOptions): Promise<Metrics | string> {
    await this.start()
    // TODO: add `metrics` method stub in c-abi engine and make it non-optional.
    // The stub should return an error like in WASM so we handle this gracefully.
    const responseString = await this.engine!.metrics!(JSON.stringify(options))
    if (options.format === 'prometheus') {
      return responseString
    }
    return this.parseEngineResponse(responseString)
  }
}

function getErrorMessageWithLink(engine: ClientEngine, title: string) {
  return genericGetErrorMessageWithLink({
    binaryTarget: engine.binaryTarget,
    title,
    version: engine.config.clientVersion!,
    engineVersion: engine.versionInfo?.commit,
    database: engine.config.activeProvider as any,
    query: engine.lastQuery!,
  })
}
