import Debug from '@prisma/debug'
import type { ErrorRecord } from '@prisma/driver-adapter-utils'
import type { BinaryTarget } from '@prisma/get-platform'
import { assertNodeAPISupported, binaryTargets, getBinaryTargetForCurrentPlatform } from '@prisma/get-platform'
import { assertAlways, type EngineTrace, type TracingHelper } from '@prisma/internals'
import { bold, green, red } from 'kleur/colors'

import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { PrismaClientKnownRequestError } from '../../errors/PrismaClientKnownRequestError'
import { PrismaClientRustPanicError } from '../../errors/PrismaClientRustPanicError'
import { PrismaClientUnknownRequestError } from '../../errors/PrismaClientUnknownRequestError'
import { prismaGraphQLToJSError } from '../../errors/utils/prismaGraphQLToJSError'
import type { BatchQueryEngineResult, EngineConfig, RequestBatchOptions, RequestOptions } from '../common/Engine'
import type { Engine } from '../common/Engine'
import type { LogEmitter, LogEventType } from '../common/types/Events'
import type { JsonQuery } from '../common/types/JsonProtocol'
import type { EngineMetricsOptions, Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from '../common/types/Metrics'
import type {
  QueryEngineEvent,
  QueryEngineLogLevel,
  QueryEnginePanicEvent,
  QueryEngineQueryEvent,
  RustRequestError,
  SyncRustError,
} from '../common/types/QueryEngine'
import type { RequestError } from '../common/types/RequestError'
import type * as Tx from '../common/types/Transaction'
import { getBatchRequestPayload } from '../common/utils/getBatchRequestPayload'
import { getErrorMessageWithLink as genericGetErrorMessageWithLink } from '../common/utils/getErrorMessageWithLink'
import { getInteractiveTransactionId } from '../common/utils/getInteractiveTransactionId'
import { defaultLibraryLoader } from './DefaultLibraryLoader'
import { reactNativeLibraryLoader } from './ReactNativeLibraryLoader'
import type { Library, LibraryLoader, QueryEngineConstructor, QueryEngineInstance } from './types/Library'
import { wasmLibraryLoader } from './WasmLibraryLoader'

const DRIVER_ADAPTER_EXTERNAL_ERROR = 'P2036'
const debug = Debug('prisma:client:libraryEngine')

function isQueryEvent(event: QueryEngineEvent): event is QueryEngineQueryEvent {
  return event.item_type === 'query' && 'query' in event
}
function isPanicEvent(event: QueryEngineEvent): event is QueryEnginePanicEvent {
  if ('level' in event) {
    return event.level === 'error' && event.message === 'PANIC'
  }
    return false
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

export class LibraryEngine implements Engine<undefined> {
  name = 'LibraryEngine' as const
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
  async transaction(action: any, headers: Tx.TransactionHeaders, arg?: any) {
    await this.start()

    const headerStr = JSON.stringify(headers)

    let result: string | undefined
    if (action === 'start') {
      const jsonOptions = JSON.stringify({
        max_wait: arg.maxWait,
        timeout: arg.timeout,
        isolation_level: arg.isolationLevel,
      })

      result = await this.engine?.startTransaction(jsonOptions, headerStr)
    } else if (action === 'commit') {
      result = await this.engine?.commitTransaction(arg.id, headerStr)
    } else if (action === 'rollback') {
      result = await this.engine?.rollbackTransaction(arg.id, headerStr)
    }

    const response = this.parseEngineResponse<{ [K: string]: unknown }>(result)

    if (isUserFacingError(response)) {
      const externalError = this.getExternalAdapterError(response)
      if (externalError) {
        throw externalError.error
      }
      throw new PrismaClientKnownRequestError(response.message, {
        code: response.error_code as string,
        clientVersion: this.config.clientVersion as string,
        meta: response.meta,
      })
    }if (typeof response.message === 'string') {
      throw new PrismaClientUnknownRequestError(response.message, {
        clientVersion: this.config.clientVersion!,
      })
    }

    return response as Tx.InteractiveTransactionInfo<undefined> | undefined
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
      throw new PrismaClientUnknownRequestError('Response from the Engine was empty', {
        clientVersion: this.config.clientVersion!,
      })
    }

    try {
      return JSON.parse(response) as T
    } catch (_err) {
      throw new PrismaClientUnknownRequestError('Unable to JSON.parse response from engine', {
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
      const { adapter } = this.config

      if (adapter) {
        debug('Using driver adapter: %O', adapter)
      }

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
          adapter,
        ),
      )
    } catch (_e) {
      const e = _e as Error
      const error = this.parseInitError(e.message)
      if (typeof error === 'string') {
        throw e
      }
        throw new PrismaClientInitializationError(error.message, this.config.clientVersion!, error.error_code)
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
    } catch (_e) {
      //
    }
    return str
  }

  private parseRequestError(str: string): RustRequestError | string {
    try {
      const error = JSON.parse(str)
      return error
    } catch (_e) {
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
        }
          throw new PrismaClientInitializationError(error.message, this.config.clientVersion!, error.error_code)
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
    { traceparent, interactiveTransaction }: RequestOptions<undefined>,
  ): Promise<{ data: T }> {
    debug(`sending request, this.libraryStarted: ${this.libraryStarted}`)
    const headerStr = JSON.stringify({ traceparent }) // object equivalent to http headers for the library
    const queryStr = JSON.stringify(query)

    try {
      await this.start()

      this.executingQueryPromise = this.engine?.query(queryStr, headerStr, interactiveTransaction?.id)

      this.lastQuery = queryStr
      const data = this.parseEngineResponse<any>(await this.executingQueryPromise)

      if (data.errors) {
        if (data.errors.length === 1) {
          throw this.buildQueryError(data.errors[0])
        }
        // this case should not happen, as the query engine only returns one error
        throw new PrismaClientUnknownRequestError(JSON.stringify(data.errors), {
          clientVersion: this.config.clientVersion!,
        })
      }if (this.loggerRustPanic) {
        throw this.loggerRustPanic
      }
      return { data }
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
      }
        throw new PrismaClientUnknownRequestError(`${error.message}\n${error.backtrace}`, {
          clientVersion: this.config.clientVersion!,
        })
    }
  }

  async requestBatch<T>(
    queries: JsonQuery[],
    { transaction, traceparent }: RequestBatchOptions<undefined>,
  ): Promise<BatchQueryEngineResult<T>[]> {
    debug('requestBatch')
    const request = getBatchRequestPayload(queries, transaction)
    await this.start()

    this.lastQuery = JSON.stringify(request)

    this.executingQueryPromise = this.engine!.query(
      this.lastQuery,
      JSON.stringify({ traceparent }),
      getInteractiveTransactionId(transaction),
    )

    const result = await this.executingQueryPromise
    const data = this.parseEngineResponse<any>(result)

    if (data.errors) {
      if (data.errors.length === 1) {
        throw this.buildQueryError(data.errors[0])
      }
      // this case should not happen, as the query engine only returns one error
      throw new PrismaClientUnknownRequestError(JSON.stringify(data.errors), {
        clientVersion: this.config.clientVersion!,
      })
    }

    const { batchResult, errors } = data
    if (Array.isArray(batchResult)) {
      return batchResult.map((result) => {
        if (result.errors && result.errors.length > 0) {
          return this.loggerRustPanic ?? this.buildQueryError(result.errors[0])
        }
        return {
          data: result,
        }
      })
    }
      if (errors && errors.length === 1) {
        throw new Error(errors[0].error)
      }
      throw new Error(JSON.stringify(data))
  }

  private buildQueryError(error: RequestError) {
    if (error.user_facing_error.is_panic && TARGET_BUILD_TYPE !== 'wasm') {
      return new PrismaClientRustPanicError(
        getErrorMessageWithLink(this, error.user_facing_error.message),
        this.config.clientVersion!,
      )
    }

    const externalError = this.getExternalAdapterError(error.user_facing_error)

    return externalError
      ? externalError.error
      : prismaGraphQLToJSError(error, this.config.clientVersion!, this.config.activeProvider!)
  }

  private getExternalAdapterError(error: RequestError['user_facing_error']): ErrorRecord | undefined {
    if (error.error_code === DRIVER_ADAPTER_EXTERNAL_ERROR && this.config.adapter) {
      const id = error.meta?.id
      assertAlways(typeof id === 'number', 'Malformed external JS error received from the engine')
      const errorRecord = this.config.adapter.errorRegistry.consumeError(id)
      assertAlways(errorRecord, 'External error with reported id was not registered')
      return errorRecord
    }
    return undefined
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

function isUserFacingError(e: unknown): e is RequestError['user_facing_error'] {
  return typeof e === 'object' && e !== null && e.error_code !== undefined
}

function getErrorMessageWithLink(engine: LibraryEngine, title: string) {
  return genericGetErrorMessageWithLink({
    binaryTarget: engine.binaryTarget,
    title,
    version: engine.config.clientVersion!,
    engineVersion: engine.versionInfo?.commit,
    database: engine.config.activeProvider as any,
    query: engine.lastQuery!,
  })
}
