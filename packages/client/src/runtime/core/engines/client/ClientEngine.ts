import { QueryCompiler, QueryCompilerConstructor, QueryEngineLogLevel } from '@prisma/client-common'
import {
  BatchResponse,
  convertCompactedRows,
  parameterizeBatch,
  parameterizeQuery,
  QueryEvent,
  QueryPlanNode,
  safeJsonStringify,
  TransactionInfo,
  UserFacingError,
} from '@prisma/client-engine-runtime'
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
} from '@prisma/client-runtime-utils'
import { Debug } from '@prisma/debug'
import type { IsolationLevel as SqlIsolationLevel, SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils'
import type { ActiveConnectorType } from '@prisma/generator'
import type { TracingHelper } from '@prisma/instrumentation-contract'
import { assertNever } from '@prisma/internals'
import type { JsonBatchQuery, JsonQuery, RawJsonQuery } from '@prisma/json-protocol'
import { ParamGraph } from '@prisma/param-graph'

import { version as clientVersion } from '../../../../../package.json'
import { deserializeRawParameters } from '../../../utils/deserializeRawParameters'
import type {
  BatchQueryEngineResult,
  EngineConfig,
  PrecomputedQueryPlanCacheHit,
  RequestBatchOptions,
  RequestOptions,
} from '../common/Engine'
import { Engine } from '../common/Engine'
import { LogEmitter, QueryEvent as ClientQueryEvent } from '../common/types/Events'
import {
  type QueryEngineResultData,
  queryEngineResultDataWasDeserialized,
  RustRequestError,
  SyncRustError,
} from '../common/types/QueryEngine'
import type * as Tx from '../common/types/Transaction'
import { InteractiveTransactionInfo } from '../common/types/Transaction'
import { getBatchRequestPayload } from '../common/utils/getBatchRequestPayload'
import { getErrorMessageWithLink as genericGetErrorMessageWithLink } from '../common/utils/getErrorMessageWithLink'
import type { Executor } from './Executor'
import { LocalExecutor } from './LocalExecutor'
import { type IndividualQueryPlanCacheEntry, QueryPlanCache } from './query-plan-cache'
import { getQueryPlanCacheMaxSize } from './query-plan-cache-size'
import { RemoteExecutor } from './RemoteExecutor'
import { QueryCompilerLoader } from './types/QueryCompiler'
import { wasmQueryCompilerLoader } from './WasmQueryCompilerLoader'

/**
 * Prisma error code for the `PrismaClientInitializationError` raised when
 * the `client` engine is instantiated without an active driver adapter.
 */
const CLIENT_ENGINE_ERROR = 'P2038'

const DEBUG_NAMESPACE = 'prisma:client:clientEngine'
const debug = Debug(DEBUG_NAMESPACE)

type GlobalWithPanicHandler = typeof globalThis & {
  PRISMA_WASM_PANIC_REGISTRY: {
    set_message?: (message: string) => void
  }
}

const globalWithPanicHandler = globalThis as GlobalWithPanicHandler

// The fallback panic handler shared across all instances. This ensures that any
// panic is caught and handled, but each instance should prefer temporarily
// setting its own local panic handler for the duration of a synchronous WASM
// function call for better error messages.
globalWithPanicHandler.PRISMA_WASM_PANIC_REGISTRY = {
  set_message(message: string) {
    throw new PrismaClientRustPanicError(message, clientVersion)
  },
}

function getStringCacheKeyPart(value: string | null | undefined): string {
  if (value == null) {
    return '-1:'
  }

  return `${value.length}:${value}`
}

function getSingleQueryCacheKey(query: JsonQuery, queryPart: string): string {
  return `s:${getStringCacheKeyPart(query.modelName)}${getStringCacheKeyPart(query.action)}${queryPart.length}:${queryPart}`
}

function getSingleQueryRequest(query: JsonQuery, queryPart: string): string {
  const actionPart = JSON.stringify(query.action)

  if (query.modelName === undefined) {
    return `{"action":${actionPart},"query":${queryPart}}`
  }

  return `{"modelName":${JSON.stringify(query.modelName)},"action":${actionPart},"query":${queryPart}}`
}

function isDebugEnabled(): boolean {
  const globalDebug = (globalThis as { DEBUG?: string }).DEBUG
  return debug.enabled || (globalDebug !== undefined && globalDebug !== '' && Debug.enabled(DEBUG_NAMESPACE))
}

function getBatchQueryCacheKey(batch: JsonBatchQuery): string {
  const queries = new Array(batch.batch.length)
  for (let i = 0; i < batch.batch.length; i++) {
    const query = batch.batch[i]
    queries[i] = [query.modelName ?? null, query.action, query.query]
  }
  return JSON.stringify([queries, batch.transaction ?? null])
}

function getIndividualBatchPlanCacheEntries(
  batch: JsonBatchQuery,
  response: BatchResponse,
  cache: QueryPlanCache,
): IndividualQueryPlanCacheEntry[] | undefined {
  if (
    response.type !== 'multi' ||
    response.plans.length !== batch.batch.length ||
    response.plans.length + 1 > cache.maxSize
  ) {
    return undefined
  }

  const entries = new Array<IndividualQueryPlanCacheEntry>(batch.batch.length)
  for (let i = 0; i < batch.batch.length; i++) {
    const query = batch.batch[i]
    const queryPart = JSON.stringify(query.query)
    entries[i] = {
      key: getSingleQueryCacheKey(query, queryPart),
      plan: response.plans[i] as QueryPlanNode,
    }
  }
  return entries
}

type PrecomputedBatch = {
  parameterizedBatch: JsonBatchQuery
  placeholderValues: Record<string, unknown>
  queryInfoQueries?: JsonQuery['query'][]
}

type PrecomputedBatchCacheHit = {
  cacheKey: string
  placeholderValues: Record<string, unknown>
  queryInfoQueries?: JsonQuery['query'][]
}

function tryBuildPrecomputedBatchCacheHit(
  batch: JsonBatchQuery,
  hits: PrecomputedQueryPlanCacheHit[] | undefined,
  hasSqlCommenters: boolean,
): PrecomputedBatchCacheHit | undefined {
  if (hits === undefined || hits.length !== batch.batch.length) {
    return undefined
  }

  const cacheKeys = new Array<string>(hits.length)
  const placeholderValues: Record<string, unknown> = {}
  const queryInfoQueries = hasSqlCommenters ? new Array<JsonQuery['query']>(hits.length) : undefined
  let nextPlaceholderId = 1

  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i]
    const parameterizedQuery = hit.parameterizedQuery
    const originalQuery = batch.batch[i]
    if (
      parameterizedQuery === undefined ||
      parameterizedQuery.modelName !== originalQuery.modelName ||
      parameterizedQuery.action !== originalQuery.action ||
      (hasSqlCommenters && hit.queryInfoQuery === undefined)
    ) {
      return undefined
    }

    cacheKeys[i] = hit.cacheKey
    for (const oldName of Object.keys(hit.placeholderValues)) {
      placeholderValues[`%${nextPlaceholderId++}`] = hit.placeholderValues[oldName]
    }
    if (queryInfoQueries !== undefined) {
      queryInfoQueries[i] = hit.queryInfoQuery!
    }
  }

  return {
    cacheKey: `p:${JSON.stringify([cacheKeys, batch.transaction ?? null])}`,
    placeholderValues,
    queryInfoQueries,
  }
}

function tryBuildPrecomputedBatch(
  batch: JsonBatchQuery,
  hits: PrecomputedQueryPlanCacheHit[] | undefined,
  hasSqlCommenters: boolean,
): PrecomputedBatch | undefined {
  if (hits === undefined || hits.length !== batch.batch.length) {
    return undefined
  }

  const parameterizedQueries = new Array<JsonQuery>(batch.batch.length)
  const placeholderValues: Record<string, unknown> = {}
  const queryInfoQueries = hasSqlCommenters ? new Array<JsonQuery['query']>(batch.batch.length) : undefined
  let nextPlaceholderId = 1

  for (let i = 0; i < batch.batch.length; i++) {
    const hit = hits[i]
    const parameterizedQuery = hit.parameterizedQuery
    const originalQuery = batch.batch[i]
    if (
      parameterizedQuery === undefined ||
      parameterizedQuery.modelName !== originalQuery.modelName ||
      parameterizedQuery.action !== originalQuery.action ||
      (hasSqlCommenters && hit.queryInfoQuery === undefined)
    ) {
      return undefined
    }

    const renamed = renamePrecomputedPlaceholders(parameterizedQuery, hit.placeholderValues, nextPlaceholderId)
    parameterizedQueries[i] = renamed.query
    nextPlaceholderId = renamed.nextPlaceholderId
    Object.assign(placeholderValues, renamed.placeholderValues)
    if (queryInfoQueries !== undefined) {
      queryInfoQueries[i] = hit.queryInfoQuery!
    }
  }

  return {
    parameterizedBatch: { ...batch, batch: parameterizedQueries },
    placeholderValues,
    queryInfoQueries,
  }
}

function renamePrecomputedPlaceholders(
  query: JsonQuery,
  values: Record<string, unknown>,
  firstPlaceholderId: number,
): { query: JsonQuery; placeholderValues: Record<string, unknown>; nextPlaceholderId: number } {
  const oldNames = Object.keys(values)
  let nextPlaceholderId = firstPlaceholderId
  let isIdentityMapping = true

  for (const oldName of oldNames) {
    const newName = `%${nextPlaceholderId++}`
    if (newName !== oldName) {
      isIdentityMapping = false
    }
  }

  if (isIdentityMapping) {
    return {
      query,
      placeholderValues: values,
      nextPlaceholderId,
    }
  }

  const placeholderNameMap = new Map<string, string>()
  const placeholderValues: Record<string, unknown> = {}
  nextPlaceholderId = firstPlaceholderId

  for (const oldName of oldNames) {
    const newName = `%${nextPlaceholderId++}`
    placeholderNameMap.set(oldName, newName)
    placeholderValues[newName] = values[oldName]
  }

  return {
    query: {
      ...query,
      query: renamePlaceholderValue(query.query, placeholderNameMap) as JsonQuery['query'],
    },
    placeholderValues,
    nextPlaceholderId,
  }
}

function renamePlaceholderValue(value: unknown, placeholderNameMap: Map<string, string>): unknown {
  if (Array.isArray(value)) {
    let renamed: unknown[] | undefined
    for (let i = 0; i < value.length; i++) {
      const nextValue = renamePlaceholderValue(value[i], placeholderNameMap)
      if (nextValue !== value[i] && renamed === undefined) {
        renamed = value.slice(0, i)
      }
      if (renamed !== undefined) {
        renamed[i] = nextValue
      }
    }
    return renamed ?? value
  }

  if (typeof value !== 'object' || value === null) {
    return value
  }

  const record = value as Record<string, unknown>
  if (record.$type === 'Param') {
    const taggedValue = record.value
    if (typeof taggedValue === 'object' && taggedValue !== null) {
      const placeholder = taggedValue as Record<string, unknown>
      const name = placeholder.name
      if (typeof name === 'string') {
        const mappedName = placeholderNameMap.get(name)
        if (mappedName !== undefined) {
          return {
            ...record,
            value: {
              ...placeholder,
              name: mappedName,
            },
          }
        }
      }
    }
  }

  let renamed: Record<string, unknown> | undefined
  for (const key of Object.keys(record)) {
    const nextValue = renamePlaceholderValue(record[key], placeholderNameMap)
    if (nextValue !== record[key] && renamed === undefined) {
      renamed = { ...record }
    }
    if (renamed !== undefined) {
      renamed[key] = nextValue
    }
  }

  return renamed ?? value
}

const EMPTY_PLACEHOLDER_VALUES: Record<string, unknown> = Object.freeze({})

interface ConnectedEngine {
  executor: Executor
  queryCompiler: QueryCompiler
}

type EngineState =
  | {
      type: 'disconnected'
    }
  | {
      type: 'connecting'
      promise: Promise<ConnectedEngine>
    }
  | {
      type: 'connected'
      engine: ConnectedEngine
    }
  | {
      type: 'disconnecting'
      promise: Promise<void>
    }

type ExecutorKind =
  | {
      remote: false
      driverAdapterFactory: SqlDriverAdapterFactory
    }
  | {
      remote: true
      accelerateUrl: string
    }

export class ClientEngine implements Engine {
  name = 'ClientEngine' as const

  #QueryCompilerConstructor?: QueryCompilerConstructor
  #state: EngineState = { type: 'disconnected' }
  #queryCompilerLoader: QueryCompilerLoader
  #executorKind: ExecutorKind
  #queryPlanCache?: QueryPlanCache
  #paramGraph: ParamGraph

  config: EngineConfig
  datamodel: string

  logEmitter: LogEmitter
  logQueries: boolean
  logLevel: QueryEngineLogLevel
  tracingHelper: TracingHelper

  #emitQueryEvent?: (event: QueryEvent) => void

  constructor(config: EngineConfig, queryCompilerLoader?: QueryCompilerLoader) {
    if (config.accelerateUrl !== undefined) {
      this.#executorKind = { remote: true, accelerateUrl: config.accelerateUrl }
    } else if (config.adapter) {
      this.#executorKind = { remote: false, driverAdapterFactory: config.adapter }
      debug('Using driver adapter: %O', config.adapter)
    } else {
      throw new PrismaClientInitializationError(
        'Missing configured driver adapter. Engine type `client` requires an active driver adapter. Please check your PrismaClient initialization code.',
        config.clientVersion,
        CLIENT_ENGINE_ERROR,
      )
    }

    if (TARGET_BUILD_TYPE === 'client' || TARGET_BUILD_TYPE === 'wasm-compiler-edge') {
      this.#queryCompilerLoader = queryCompilerLoader ?? wasmQueryCompilerLoader
    } else {
      throw new Error(`Invalid TARGET_BUILD_TYPE: ${TARGET_BUILD_TYPE}`)
    }

    this.config = config
    this.logQueries = config.logQueries ?? false
    this.logLevel = config.logLevel ?? 'error'
    this.logEmitter = config.logEmitter
    this.datamodel = config.inlineSchema
    this.tracingHelper = config.tracingHelper
    const queryPlanCacheMaxSize = getQueryPlanCacheMaxSize(config.queryPlanCacheMaxSize)
    this.#queryPlanCache = queryPlanCacheMaxSize === undefined ? undefined : new QueryPlanCache(queryPlanCacheMaxSize)
    this.#paramGraph = ParamGraph.deserialize(config.parameterizationSchema, (enumName) => {
      if (!Object.hasOwn(config.runtimeDataModel.enums, enumName)) {
        return undefined
      }
      const mapping: Record<string, string> = {}
      for (const value of config.runtimeDataModel.enums[enumName].values) {
        mapping[value.name] = value.dbName ?? value.name
      }
      return mapping
    })

    if (config.enableDebugLogs) {
      this.logLevel = 'debug'
    }

    if (this.logQueries) {
      this.#emitQueryEvent = (event: QueryEvent) => {
        this.logEmitter.emit('query', {
          ...event,
          // TODO: we should probably change the interface to contain a proper array in the next major version.
          params: safeJsonStringify(event.params),
          // TODO: this field only exists for historical reasons as we grandfathered it from the time
          // when we emitted `tracing` events to stdout in the engine unchanged, and then described
          // them in the public API as TS types. Thus this field used to contain the name of the Rust
          // module in which an event originated. When using library engine, which uses a different
          // mechanism with a JavaScript callback for logs, it's normally just an empty string instead.
          // This field is definitely not useful and should be removed from the public types (but it's
          // technically a breaking change, even if a tiny and inconsequential one).
          target: 'ClientEngine',
        } satisfies ClientQueryEvent)
      }
    }
  }

  async #ensureStarted(): Promise<ConnectedEngine> {
    switch (this.#state.type) {
      case 'disconnected': {
        const connecting = this.tracingHelper.runInChildSpan('connect', async () => {
          let executor: Executor | undefined = undefined
          let queryCompiler: QueryCompiler | undefined = undefined

          try {
            executor = await this.#connectExecutor()
            queryCompiler = await this.#instantiateQueryCompiler(executor)
          } catch (error) {
            this.#state = { type: 'disconnected' }
            queryCompiler?.free()
            await executor?.disconnect()
            throw error
          }

          const engine: ConnectedEngine = {
            executor,
            queryCompiler,
          }

          this.#state = { type: 'connected', engine }

          return engine
        })

        this.#state = {
          type: 'connecting',
          promise: connecting,
        }

        return await connecting
      }

      case 'connecting':
        return await this.#state.promise

      case 'connected':
        return this.#state.engine

      case 'disconnecting':
        await this.#state.promise
        return await this.#ensureStarted()
    }
  }

  #getConnectedEngine(): ConnectedEngine | undefined {
    return this.#state.type === 'connected' ? this.#state.engine : undefined
  }

  async #connectExecutor(): Promise<Executor> {
    if (this.#executorKind.remote) {
      return new RemoteExecutor({
        clientVersion: this.config.clientVersion,
        accelerateUrl: this.#executorKind.accelerateUrl,
        logEmitter: this.logEmitter,
        logLevel: this.logLevel,
        logQueries: this.logQueries,
        tracingHelper: this.tracingHelper,
        sqlCommenters: this.config.sqlCommenters,
      })
    } else {
      return await LocalExecutor.connect({
        driverAdapterFactory: this.#executorKind.driverAdapterFactory,
        tracingHelper: this.tracingHelper,
        transactionOptions: {
          ...this.config.transactionOptions,
          isolationLevel: this.#convertIsolationLevel(this.config.transactionOptions.isolationLevel),
        },
        onQuery: this.#emitQueryEvent,
        provider: this.config.activeProvider as ActiveConnectorType | undefined,
        sqlCommenters: this.config.sqlCommenters,
      })
    }
  }

  async #instantiateQueryCompiler(executor: Executor): Promise<QueryCompiler> {
    // We reuse the `QueryCompilerConstructor` from the same `WebAssembly.Instance` between
    // reconnects as long as there are no panics. This avoids the overhead of loading and
    // JIT compiling the WebAssembly module after every reconnect. If it panics, we discard
    // it and load a new one from scratch if the client reconnects again.
    let QueryCompilerConstructor = this.#QueryCompilerConstructor

    if (QueryCompilerConstructor === undefined) {
      QueryCompilerConstructor = await this.#queryCompilerLoader.loadQueryCompiler(this.config)
      this.#QueryCompilerConstructor = QueryCompilerConstructor
    }

    const { provider, connectionInfo } = await executor.getConnectionInfo()

    try {
      return this.#withLocalPanicHandler(
        () =>
          new QueryCompilerConstructor({
            datamodel: this.datamodel,
            provider,
            connectionInfo,
          }),
        undefined,
        false,
      )
    } catch (e) {
      throw this.#transformInitError(e)
    }
  }

  #transformInitError(err: Error): Error {
    if (err instanceof PrismaClientRustPanicError) {
      return err
    }
    try {
      const error: SyncRustError = JSON.parse(err.message)
      return new PrismaClientInitializationError(error.message, this.config.clientVersion, error.error_code)
    } catch (e) {
      return err
    }
  }

  #transformRequestError(err: any, query?: string): Error {
    if (err instanceof PrismaClientInitializationError) return err

    if (err.code === 'GenericFailure' && err.message?.startsWith('PANIC:'))
      return new PrismaClientRustPanicError(
        getErrorMessageWithLink(this, err.message, query),
        this.config.clientVersion,
      )

    if (err instanceof UserFacingError) {
      return new PrismaClientKnownRequestError(err.message, {
        code: err.code,
        meta: err.meta,
        clientVersion: this.config.clientVersion,
      })
    }

    try {
      const error: RustRequestError = JSON.parse(err as string)
      return new PrismaClientUnknownRequestError(`${error.message}\n${error.backtrace}`, {
        clientVersion: this.config.clientVersion,
      })
    } catch (e) {
      return err
    }
  }

  #transformCompileError(error: any): any {
    if (error instanceof PrismaClientRustPanicError) {
      return error
    }

    if (typeof error['message'] === 'string' && typeof error['code'] === 'string') {
      return new PrismaClientKnownRequestError(error['message'], {
        code: error['code'],
        meta: error.meta,
        clientVersion: this.config.clientVersion,
      })
    } else if (typeof error['message'] === 'string') {
      return new PrismaClientUnknownRequestError(error['message'], { clientVersion: this.config.clientVersion })
    } else {
      return error
    }
  }

  #withLocalPanicHandler<T>(fn: () => T, query?: string, disconnectOnPanic = true): T {
    const previousHandler = globalWithPanicHandler.PRISMA_WASM_PANIC_REGISTRY.set_message
    let panic: string | undefined = undefined

    global.PRISMA_WASM_PANIC_REGISTRY.set_message = (message: string) => {
      panic = message
    }

    try {
      return fn()
    } finally {
      global.PRISMA_WASM_PANIC_REGISTRY.set_message = previousHandler

      if (panic) {
        // Discard the current `WebAssembly.Instance` to avoid memory leaks:
        // WebAssembly doesn't unwind the stack or call destructors on panic.
        this.#QueryCompilerConstructor = undefined
        // Disconnect and drop the compiler, unless this panic happened during
        // initialization. In that case, we let `#ensureStarted` deal with it
        // and change the state to `disconnected` by itself.
        if (disconnectOnPanic) {
          void this.stop().catch((err) => debug('failed to disconnect:', err))
        }
        // eslint-disable-next-line no-unsafe-finally
        throw new PrismaClientRustPanicError(getErrorMessageWithLink(this, panic, query), this.config.clientVersion)
      }
    }
  }

  onBeforeExit() {
    throw new Error(
      '"beforeExit" hook is not applicable to the client engine, it is only relevant and implemented for the binary engine. Please add your event listener to the `process` object directly instead.',
    )
  }

  async start(): Promise<void> {
    await this.#ensureStarted()
  }

  async stop(): Promise<void> {
    switch (this.#state.type) {
      case 'disconnected':
        return

      case 'connecting':
        await this.#state.promise
        return await this.stop()

      case 'connected': {
        const engine = this.#state.engine

        const disconnecting = this.tracingHelper.runInChildSpan('disconnect', async () => {
          try {
            await engine.executor.disconnect()
            engine.queryCompiler.free()
          } finally {
            this.#state = { type: 'disconnected' }
          }
        })

        this.#state = {
          type: 'disconnecting',
          promise: disconnecting,
        }

        return await disconnecting
      }

      case 'disconnecting':
        return await this.#state.promise
    }
  }

  version(): string {
    return 'unknown'
  }

  async transaction(
    action: 'start',
    headers: Tx.TransactionHeaders,
    options: Tx.Options,
  ): Promise<Tx.InteractiveTransactionInfo>
  async transaction(
    action: 'commit',
    headers: Tx.TransactionHeaders,
    info: Tx.InteractiveTransactionInfo,
  ): Promise<undefined>
  async transaction(
    action: 'rollback',
    headers: Tx.TransactionHeaders,
    info: Tx.InteractiveTransactionInfo,
  ): Promise<undefined>
  async transaction(
    action: 'start' | 'commit' | 'rollback',
    _headers: Tx.TransactionHeaders,
    arg?: any,
  ): Promise<Tx.InteractiveTransactionInfo | undefined> {
    let result: TransactionInfo | undefined

    const { executor } = await this.#ensureStarted()

    try {
      if (action === 'start') {
        const options: Tx.Options = arg
        result = await executor.startTransaction({
          ...options,
          isolationLevel: this.#convertIsolationLevel(options.isolationLevel),
        })
      } else if (action === 'commit') {
        const txInfo: Tx.InteractiveTransactionInfo<undefined> = arg
        await executor.commitTransaction(txInfo)
      } else if (action === 'rollback') {
        const txInfo: Tx.InteractiveTransactionInfo<undefined> = arg
        await executor.rollbackTransaction(txInfo)
      } else {
        assertNever(action, 'Invalid transaction action.')
      }
    } catch (error) {
      throw this.#transformRequestError(error)
    }

    return result ? { id: result.id, payload: undefined } : undefined
  }

  async request<T>(
    query: JsonQuery,
    { interactiveTransaction, precomputedQueryPlanCacheHit, customDataProxyFetch }: RequestOptions<unknown>,
  ): Promise<{ data: T }> {
    const debugEnabled = isDebugEnabled()
    if (debugEnabled) {
      debug(`sending request`)
    }

    const { executor, queryCompiler } =
      this.#getConnectedEngine() ??
      (await this.#ensureStarted().catch((err) => {
        throw this.#transformRequestError(err, JSON.stringify(query))
      }))

    let plan: QueryPlanNode
    let placeholderValues = EMPTY_PLACEHOLDER_VALUES
    const hasSqlCommenters = this.config.sqlCommenters !== undefined && this.config.sqlCommenters.length > 0
    let queryInfoQuery = hasSqlCommenters ? query.query : undefined

    if (isRawQuery(query)) {
      plan = compileRawQuery(query)
    } else {
      // We do not cache `createMany` and `createManyAndReturn` queries as they are very unlikely
      // to benefit from caching due to their high variability in parameters, which leads to a very
      // high cache miss rate and potential cache bloat.
      const isCacheable = query.action !== 'createMany' && query.action !== 'createManyAndReturn'

      const queryPlanCache = this.#queryPlanCache
      const precomputed = precomputedQueryPlanCacheHit
      const cachedPrecomputedPlan =
        isCacheable &&
        queryPlanCache !== undefined &&
        precomputed !== undefined &&
        (!hasSqlCommenters || precomputed.queryInfoQuery !== undefined)
          ? queryPlanCache.getSingle(precomputed.cacheKey)
          : undefined

      if (cachedPrecomputedPlan !== undefined && precomputed !== undefined) {
        if (debugEnabled) {
          debug('query plan cache hit')
        }
        plan = cachedPrecomputedPlan
        placeholderValues = precomputed.placeholderValues
        if (hasSqlCommenters) {
          queryInfoQuery = precomputed.queryInfoQuery
        }
      } else {
        const { parameterizedQuery, placeholderValues: extractedValues } = parameterizeQuery(query, this.#paramGraph)
        placeholderValues = extractedValues
        if (hasSqlCommenters) {
          queryInfoQuery = parameterizedQuery.query
        }

        if (isCacheable && queryPlanCache !== undefined) {
          const queryPart = JSON.stringify(parameterizedQuery.query)
          const cacheKey = getSingleQueryCacheKey(parameterizedQuery, queryPart)
          const cached = queryPlanCache.getSingle(cacheKey)
          if (cached) {
            if (debugEnabled) {
              debug('query plan cache hit')
            }
            plan = cached
          } else {
            if (debugEnabled) {
              debug('query plan cache miss')
            }
            const request = getSingleQueryRequest(parameterizedQuery, queryPart)
            plan = this.#compileQuery(parameterizedQuery, request, queryCompiler)
            queryPlanCache.setSingle(cacheKey, plan)
          }
        } else {
          const request = JSON.stringify(parameterizedQuery)
          plan = this.#compileQuery(parameterizedQuery, request, queryCompiler)
        }
      }
    }

    try {
      if (debugEnabled) {
        debug(`query plan created`, plan)
      }

      const result = await executor.execute({
        plan,
        model: query.modelName,
        operation: query.action,
        placeholderValues,
        transaction: interactiveTransaction,
        batchIndex: undefined,
        customFetch: customDataProxyFetch?.(globalThis.fetch),
        queryInfo: hasSqlCommenters
          ? {
              type: 'single',
              modelName: query.modelName,
              action: query.action,
              query: queryInfoQuery!,
            }
          : undefined,
      })

      if (debugEnabled) {
        debug(`query plan executed`)
      }

      const response: QueryEngineResultData<T> = { data: { [query.action]: result } as T }
      if (executor.resultFormat === 'js' && !isRawQuery(query)) {
        response[queryEngineResultDataWasDeserialized] = true
      }
      return response
    } catch (e: any) {
      throw this.#transformRequestError(e, JSON.stringify(query))
    }
  }

  async requestWithPrecomputedQueryPlanCacheHit<T>(
    query: JsonQuery,
    options: RequestOptions<unknown>,
  ): Promise<{
    response: { data: T }
    precomputedQueryPlanCacheHit?: PrecomputedQueryPlanCacheHit
  }> {
    const response = await this.request<T>(query, options)

    return {
      response,
      precomputedQueryPlanCacheHit: this.getPrecomputedQueryPlanCacheHit(query),
    }
  }

  async requestPrecomputedCachedResult<T>(
    query: JsonQuery,
    precomputedQueryPlanCacheHit: PrecomputedQueryPlanCacheHit,
    { interactiveTransaction, isWrite, customDataProxyFetch }: RequestOptions<unknown>,
  ): Promise<T> {
    if (interactiveTransaction !== undefined || this.config.sqlCommenters !== undefined || isRawQuery(query)) {
      const response = await this.request<Record<string, T>>(query, {
        interactiveTransaction,
        isWrite,
        precomputedQueryPlanCacheHit,
        customDataProxyFetch,
      })
      return response.data[query.action]
    }

    const queryPlanCache = this.#queryPlanCache
    const cachedPlan = queryPlanCache?.getSingle(precomputedQueryPlanCacheHit.cacheKey)
    if (cachedPlan === undefined) {
      const parameterizedQuery = precomputedQueryPlanCacheHit.parameterizedQuery
      if (parameterizedQuery.modelName !== query.modelName || parameterizedQuery.action !== query.action) {
        throw new Error('Precomputed query plan cache hit does not match the request query')
      }

      const { executor, queryCompiler } =
        this.#getConnectedEngine() ??
        (await this.#ensureStarted().catch((err) => {
          throw this.#transformRequestError(err, JSON.stringify(query))
        }))

      let plan = queryPlanCache?.getSingle(precomputedQueryPlanCacheHit.cacheKey)
      if (plan === undefined) {
        try {
          const queryPart = JSON.stringify(parameterizedQuery.query)
          const request = getSingleQueryRequest(parameterizedQuery, queryPart)
          plan = this.#compileQuery(parameterizedQuery, request, queryCompiler)
          queryPlanCache?.setSingle(precomputedQueryPlanCacheHit.cacheKey, plan)
        } catch (error) {
          throw this.#transformCompileError(error)
        }
      }

      try {
        return (await executor.execute({
          plan,
          model: parameterizedQuery.modelName,
          operation: parameterizedQuery.action,
          placeholderValues: precomputedQueryPlanCacheHit.placeholderValues,
          transaction: undefined,
          batchIndex: undefined,
          customFetch: customDataProxyFetch?.(globalThis.fetch),
        })) as T
      } catch (e: any) {
        throw this.#transformRequestError(e, JSON.stringify(query))
      }
    }

    const { executor } =
      this.#getConnectedEngine() ??
      (await this.#ensureStarted().catch((err) => {
        throw this.#transformRequestError(err, JSON.stringify(query))
      }))

    try {
      return (await executor.execute({
        plan: cachedPlan,
        model: query.modelName,
        operation: query.action,
        placeholderValues: precomputedQueryPlanCacheHit.placeholderValues,
        transaction: undefined,
        batchIndex: undefined,
        customFetch: customDataProxyFetch?.(globalThis.fetch),
      })) as T
    } catch (e: any) {
      throw this.#transformRequestError(e, JSON.stringify(query))
    }
  }

  getPrecomputedQueryPlanCacheHit(query: JsonQuery): PrecomputedQueryPlanCacheHit | undefined {
    if (isRawQuery(query) || query.action === 'createMany' || query.action === 'createManyAndReturn') {
      return undefined
    }

    const { parameterizedQuery, placeholderValues } = parameterizeQuery(query, this.#paramGraph)
    const queryPart = JSON.stringify(parameterizedQuery.query)

    return {
      cacheKey: getSingleQueryCacheKey(parameterizedQuery, queryPart),
      placeholderValues,
      parameterizedQuery,
      queryInfoQuery:
        this.config.sqlCommenters !== undefined && this.config.sqlCommenters.length > 0
          ? parameterizedQuery.query
          : undefined,
    }
  }

  async requestBatch<T>(
    queries: JsonQuery[],
    { transaction, customDataProxyFetch, precomputedQueryPlanCacheHits }: RequestBatchOptions<unknown>,
  ): Promise<BatchQueryEngineResult<T>[]> {
    if (queries.length === 0) {
      return []
    }

    const debugEnabled = isDebugEnabled()
    const firstAction = queries[0].action
    const firstModelName = queries[0].modelName

    const batchPayload = getBatchRequestPayload(queries, transaction)
    let request: string | undefined
    const stringifyBatchRequest = () => (request ??= JSON.stringify(batchPayload))

    const { executor, queryCompiler } =
      this.#getConnectedEngine() ??
      (await this.#ensureStarted().catch((err) => {
        throw this.#transformRequestError(err, stringifyBatchRequest())
      }))

    const hasRawQueries = firstModelName === undefined
    let batchResponse: BatchResponse | undefined
    let placeholderValues = EMPTY_PLACEHOLDER_VALUES
    const hasSqlCommenters = this.config.sqlCommenters !== undefined && this.config.sqlCommenters.length > 0
    let queryInfoQueries: JsonQuery['query'][] | undefined

    if (!hasRawQueries) {
      const queryPlanCache = this.#queryPlanCache
      const jsonBatchPayload = batchPayload as JsonBatchQuery
      const precomputedBatchCacheHit = tryBuildPrecomputedBatchCacheHit(
        jsonBatchPayload,
        precomputedQueryPlanCacheHits,
        hasSqlCommenters,
      )
      if (queryPlanCache !== undefined && precomputedBatchCacheHit !== undefined) {
        const cached = queryPlanCache.getBatch(precomputedBatchCacheHit.cacheKey)
        if (cached) {
          if (debugEnabled) {
            debug('batch query plan cache hit')
          }
          batchResponse = cached
          placeholderValues = precomputedBatchCacheHit.placeholderValues
          queryInfoQueries = precomputedBatchCacheHit.queryInfoQueries
        }
      }

      if (batchResponse === undefined) {
        const precomputedBatch = tryBuildPrecomputedBatch(
          jsonBatchPayload,
          precomputedQueryPlanCacheHits,
          hasSqlCommenters,
        )
        let parameterizedBatch: JsonBatchQuery
        if (precomputedBatch !== undefined) {
          parameterizedBatch = precomputedBatch.parameterizedBatch
          placeholderValues = precomputedBatch.placeholderValues
          queryInfoQueries = precomputedBatch.queryInfoQueries
        } else {
          const parameterized = parameterizeBatch(jsonBatchPayload, this.#paramGraph)
          parameterizedBatch = parameterized.parameterizedBatch
          placeholderValues = parameterized.placeholderValues
        }
        if (hasSqlCommenters && queryInfoQueries === undefined) {
          queryInfoQueries = new Array(parameterizedBatch.batch.length)
          for (let i = 0; i < parameterizedBatch.batch.length; i++) {
            queryInfoQueries[i] = parameterizedBatch.batch[i].query
          }
        }

        if (queryPlanCache !== undefined) {
          const cacheKey = precomputedBatchCacheHit?.cacheKey ?? getBatchQueryCacheKey(parameterizedBatch)
          const cached = queryPlanCache.getBatch(cacheKey)
          if (cached) {
            if (debugEnabled) {
              debug('batch query plan cache hit')
            }
            batchResponse = cached
          } else {
            if (debugEnabled) {
              debug('batch query plan cache miss')
            }
            try {
              const request = JSON.stringify(parameterizedBatch)
              batchResponse = this.#compileBatch(parameterizedBatch.batch, request, queryCompiler)
              queryPlanCache.setBatch(
                cacheKey,
                batchResponse,
                getIndividualBatchPlanCacheEntries(parameterizedBatch, batchResponse, queryPlanCache),
              )
            } catch (error) {
              throw this.#transformCompileError(error)
            }
          }
        } else {
          if (debugEnabled) {
            debug('batch query plan cache miss')
          }
          try {
            const request = JSON.stringify(parameterizedBatch)
            batchResponse = this.#compileBatch(parameterizedBatch.batch, request, queryCompiler)
          } catch (error) {
            throw this.#transformCompileError(error)
          }
        }
      }
    } else {
      if (hasSqlCommenters) {
        queryInfoQueries = new Array(queries.length)
        for (let i = 0; i < queries.length; i++) {
          queryInfoQueries[i] = queries[i].query
        }
      }

      batchResponse = this.#compileBatch(queries, stringifyBatchRequest(), queryCompiler)
    }

    if (batchResponse === undefined) {
      throw new Error('Internal error: batch response was not initialized.')
    }

    try {
      let txInfo: InteractiveTransactionInfo | undefined
      if (transaction?.kind === 'itx') {
        // If we are already in an interactive transaction we do not nest transactions
        txInfo = transaction.options
      }

      switch (batchResponse.type) {
        case 'multi': {
          if (transaction?.kind !== 'itx') {
            const batchOptions = transaction?.options
            const txOptions = {
              maxWait: batchOptions?.maxWait ?? this.config.transactionOptions.maxWait,
              timeout: batchOptions?.timeout ?? this.config.transactionOptions.timeout,
              isolationLevel: batchOptions?.isolationLevel ?? this.config.transactionOptions.isolationLevel,
            }
            txInfo = await this.transaction('start', {}, txOptions)
          }

          const results: BatchQueryEngineResult<unknown>[] = []
          let rollback = false
          for (const [batchIndex, plan] of batchResponse.plans.entries()) {
            try {
              const rows = await executor.execute({
                plan: plan as QueryPlanNode,
                placeholderValues,
                model: queries[batchIndex].modelName,
                operation: queries[batchIndex].action,
                batchIndex,
                transaction: txInfo,
                customFetch: customDataProxyFetch?.(globalThis.fetch) as typeof globalThis.fetch | undefined,
                queryInfo: hasSqlCommenters
                  ? {
                      type: 'single',
                      modelName: queries[batchIndex].modelName,
                      action: queries[batchIndex].action,
                      query: queryInfoQueries![batchIndex],
                    }
                  : undefined,
              })
              const response: QueryEngineResultData<unknown> = { data: { [queries[batchIndex].action]: rows } }
              if (executor.resultFormat === 'js' && !isRawQuery(queries[batchIndex])) {
                response[queryEngineResultDataWasDeserialized] = true
              }
              results.push(response)
            } catch (err) {
              results.push(err as Error)
              rollback = true
              break
            }
          }

          if (txInfo !== undefined && transaction?.kind !== 'itx') {
            if (rollback) {
              await this.transaction('rollback', {}, txInfo)
            } else {
              await this.transaction('commit', {}, txInfo)
            }
          }
          return results as BatchQueryEngineResult<T>[]
        }
        case 'compacted': {
          if (!queries.every((q) => q.action === firstAction && q.modelName === firstModelName)) {
            const actions = queries.map((q) => q.action).join(', ')
            const modelNames = queries.map((q) => q.modelName).join(', ')
            throw new Error(
              `Internal error: All queries in a compacted batch must have the same action and model name, but received actions: [${actions}] and model names: [${modelNames}]. ` +
                'This indicates a bug in the client. Please report this issue to the Prisma team with your query details.',
            )
          }

          if (firstModelName === undefined) {
            throw new Error(
              'Internal error: A compacted batch cannot contain raw queries. ' +
                'This indicates a bug in the client. Please report this issue to the Prisma team with your query details.',
            )
          }

          const rows = await executor.execute({
            plan: batchResponse.plan as QueryPlanNode,
            placeholderValues,
            model: firstModelName,
            operation: firstAction,
            batchIndex: undefined,
            transaction: txInfo,
            customFetch: customDataProxyFetch?.(globalThis.fetch) as typeof globalThis.fetch | undefined,
            queryInfo: hasSqlCommenters
              ? {
                  type: 'compacted',
                  action: firstAction,
                  modelName: firstModelName,
                  queries: queryInfoQueries!,
                }
              : undefined,
          })

          const results = convertCompactedRows(rows as {}[], batchResponse, placeholderValues)
          return results.map((result) => {
            const response: QueryEngineResultData<T> = { data: { [firstAction]: result } as T }
            if (executor.resultFormat === 'js') {
              response[queryEngineResultDataWasDeserialized] = true
            }
            return response as BatchQueryEngineResult<T>
          })
        }
      }
    } catch (e: any) {
      throw this.#transformRequestError(e, stringifyBatchRequest())
    }
  }

  /**
   * Used by `@prisma/extension-accelerate`
   */
  async apiKey(): Promise<string | null> {
    const { executor } = await this.#ensureStarted()
    return executor.apiKey()
  }

  #compileQuery(query: JsonQuery, request: string, compiler: QueryCompiler): QueryPlanNode {
    try {
      return this.#withLocalPanicHandler(() =>
        this.#withCompileSpan({
          queries: [query],
          execute: () => compiler.compile(request),
        }),
      )
    } catch (error) {
      throw this.#transformCompileError(error)
    }
  }

  #compileBatch(queries: JsonQuery[], request: string, compiler: QueryCompiler): BatchResponse {
    if (queries.every(isRawQuery)) {
      return {
        type: 'multi',
        plans: queries.map((q) => compileRawQuery(q)),
      }
    }

    try {
      return this.#withLocalPanicHandler(() =>
        this.#withCompileSpan({
          queries,
          execute: () => compiler.compileBatch(request),
        }),
      )
    } catch (err) {
      throw this.#transformCompileError(err)
    }
  }

  #convertIsolationLevel(clientIsolationLevel: Tx.IsolationLevel | undefined): SqlIsolationLevel | undefined {
    switch (clientIsolationLevel) {
      case undefined:
        return undefined
      case 'ReadUncommitted':
        return 'READ UNCOMMITTED'
      case 'ReadCommitted':
        return 'READ COMMITTED'
      case 'RepeatableRead':
        return 'REPEATABLE READ'
      case 'Serializable':
        return 'SERIALIZABLE'
      case 'Snapshot':
        return 'SNAPSHOT'
      default:
        throw new PrismaClientKnownRequestError(
          `Inconsistent column data: Conversion failed: Invalid isolation level \`${
            clientIsolationLevel satisfies never
          }\``,
          {
            code: 'P2023',
            clientVersion: this.config.clientVersion,
            meta: {
              providedIsolationLevel: clientIsolationLevel,
            },
          },
        )
    }
  }

  #withCompileSpan<T>({ queries, execute }: { queries: JsonQuery[]; execute: () => T }): T {
    return this.tracingHelper.runInChildSpan(
      {
        name: 'compile',
        attributes: {
          models: queries.map((q) => q.modelName).filter((m) => m !== undefined),
          actions: queries.map((q) => q.action),
        },
      },
      execute,
    )
  }
}

function getErrorMessageWithLink(engine: ClientEngine, title: string, query?: string) {
  return genericGetErrorMessageWithLink({
    binaryTarget: undefined,
    title,
    version: engine.config.clientVersion,
    engineVersion: 'unknown', // WASM engines do not export their version info
    database: engine.config.activeProvider as any,
    query,
  })
}

function isRawQuery(query: JsonQuery): query is RawJsonQuery {
  return query.action === 'queryRaw' || query.action === 'executeRaw'
}

function compileRawQuery(query: RawJsonQuery): QueryPlanNode {
  const sql = query.query.arguments.query
  const { args, argTypes } = deserializeRawParameters(query.query.arguments.parameters)
  return [query.action === 'queryRaw' ? 'q' : 'x', { type: 'rawSql', sql, args, argTypes }]
}
