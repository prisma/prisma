import {
  BatchResponse,
  CompactedBatchResponse,
  QueryCompiler,
  QueryCompilerConstructor,
  QueryEngineLogLevel,
} from '@prisma/client-common'
import {
  QueryEvent,
  QueryInterpreter,
  QueryInterpreterTransactionManager,
  QueryPlanNode,
  TransactionInfo,
  TransactionManager,
  TransactionManagerError,
} from '@prisma/client-engine-runtime'
import { Debug } from '@prisma/debug'
import { Provider, type SqlDriverAdapter } from '@prisma/driver-adapter-utils'
import { assertNever, TracingHelper } from '@prisma/internals'

import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { PrismaClientKnownRequestError } from '../../errors/PrismaClientKnownRequestError'
import { PrismaClientRustPanicError } from '../../errors/PrismaClientRustPanicError'
import { PrismaClientUnknownRequestError } from '../../errors/PrismaClientUnknownRequestError'
import type { BatchQueryEngineResult, EngineConfig, RequestBatchOptions, RequestOptions } from '../common/Engine'
import { Engine } from '../common/Engine'
import { LogEmitter, QueryEvent as ClientQueryEvent } from '../common/types/Events'
import { JsonQuery } from '../common/types/JsonProtocol'
import { EngineMetricsOptions, Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from '../common/types/Metrics'
import { RustRequestError, SyncRustError } from '../common/types/QueryEngine'
import type * as Tx from '../common/types/Transaction'
import { InteractiveTransactionInfo } from '../common/types/Transaction'
import { getBatchRequestPayload } from '../common/utils/getBatchRequestPayload'
import { getErrorMessageWithLink as genericGetErrorMessageWithLink } from '../common/utils/getErrorMessageWithLink'
import { QueryCompilerLoader } from './types/QueryCompiler'
import { wasmQueryCompilerLoader } from './WasmQueryCompilerLoader'

const CLIENT_ENGINE_ERROR = 'P2038'

const debug = Debug('prisma:client:clientEngine')

export class ClientEngine implements Engine<undefined> {
  name = 'ClientEngine' as const

  queryCompiler?: QueryCompiler
  instantiateQueryCompilerPromise: Promise<void>
  QueryCompilerConstructor?: QueryCompilerConstructor
  queryCompilerLoader: QueryCompilerLoader

  adapterPromise: Promise<SqlDriverAdapter>
  transactionManagerPromise: Promise<TransactionManager>

  config: EngineConfig
  provider: Provider
  datamodel: string

  logEmitter: LogEmitter
  logQueries: boolean // TODO: actually implement
  logLevel: QueryEngineLogLevel
  lastStartedQuery?: string
  tracingHelper: TracingHelper

  #emitQueryEvent?: (event: QueryEvent) => void

  constructor(config: EngineConfig, queryCompilerLoader?: QueryCompilerLoader) {
    if (!config.previewFeatures?.includes('driverAdapters')) {
      throw new PrismaClientInitializationError(
        'EngineType `client` requires the driverAdapters preview feature to be enabled.',
        config.clientVersion!,
        CLIENT_ENGINE_ERROR,
      )
    }
    if (!config.adapter) {
      throw new PrismaClientInitializationError(
        'Missing configured driver adapter. Engine type `client` requires an active driver adapter. Please check your PrismaClient initialization code.',
        config.clientVersion!,
        CLIENT_ENGINE_ERROR,
      )
    } else {
      this.adapterPromise = config.adapter.connect()
      this.provider = config.adapter.provider
      debug('Using driver adapter: %O', config.adapter)
    }

    if (TARGET_BUILD_TYPE === 'client') {
      this.queryCompilerLoader = queryCompilerLoader ?? wasmQueryCompilerLoader
    } else {
      throw new Error(`Invalid TARGET_BUILD_TYPE: ${TARGET_BUILD_TYPE}`)
    }

    this.config = config
    this.logQueries = config.logQueries ?? false
    this.logLevel = config.logLevel ?? 'error'
    this.logEmitter = config.logEmitter
    this.datamodel = config.inlineSchema
    this.tracingHelper = config.tracingHelper

    if (config.enableDebugLogs) {
      this.logLevel = 'debug'
    }

    if (this.logQueries) {
      this.#emitQueryEvent = (event: QueryEvent) => {
        this.logEmitter.emit('query', {
          ...event,
          // TODO: we should probably change the interface to contain a proper array in the next major version.
          params: JSON.stringify(event.params),
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

    this.transactionManagerPromise = this.adapterPromise.then((driverAdapter) => {
      return new TransactionManager({
        driverAdapter,
        transactionOptions: this.config.transactionOptions,
        tracingHelper: this.tracingHelper,
      })
    })

    this.instantiateQueryCompilerPromise = this.instantiateQueryCompiler()
  }

  applyPendingMigrations(): Promise<void> {
    throw new Error('Cannot call applyPendingMigrations on engine type client.')
  }

  private async instantiateQueryCompiler(): Promise<void> {
    if (this.queryCompiler) {
      return
    }

    if (!this.QueryCompilerConstructor) {
      this.QueryCompilerConstructor = await this.queryCompilerLoader.loadQueryCompiler(this.config)
    }

    try {
      this.queryCompiler = new this.QueryCompilerConstructor({
        datamodel: this.datamodel,
        provider: this.provider,
        connectionInfo: {},
      })
    } catch (e) {
      throw this.#transformInitError(e)
    }
  }

  #transformInitError(err: Error): Error {
    try {
      const error: SyncRustError = JSON.parse(err.message)
      return new PrismaClientInitializationError(error.message, this.config.clientVersion!, error.error_code)
    } catch (e) {
      return err
    }
  }

  #transformRequestError(err: any): Error {
    if (err instanceof PrismaClientInitializationError) return err

    if (err.code === 'GenericFailure' && err.message?.startsWith('PANIC:') && TARGET_BUILD_TYPE !== 'wasm')
      return new PrismaClientRustPanicError(getErrorMessageWithLink(this, err.message), this.config.clientVersion!)

    if (err instanceof TransactionManagerError) {
      return new PrismaClientKnownRequestError(err.message, {
        code: err.code,
        meta: err.meta,
        clientVersion: this.config.clientVersion,
      })
    }

    try {
      const error: RustRequestError = JSON.parse(err as string)
      return new PrismaClientUnknownRequestError(`${error.message}\n${error.backtrace}`, {
        clientVersion: this.config.clientVersion!,
      })
    } catch (e) {
      return err
    }
  }

  #transformCompileError(error: any): any {
    if (typeof error['message'] === 'string' && typeof error['code'] === 'string') {
      return new PrismaClientKnownRequestError(error['message'], {
        code: error['code'],
        meta: error.meta,
        clientVersion: this.config.clientVersion,
      })
    } else {
      return error
    }
  }

  onBeforeExit() {
    throw new Error(
      '"beforeExit" hook is not applicable to the client engine, it is only relevant and implemented for the binary engine. Please add your event listener to the `process` object directly instead.',
    )
  }

  async start(): Promise<void> {
    await this.tracingHelper.runInChildSpan('connect', () => this.ensureStarted())
  }

  async stop(): Promise<void> {
    await this.tracingHelper.runInChildSpan('disconnect', async () => {
      await this.instantiateQueryCompilerPromise
      await (await this.transactionManagerPromise)?.cancelAllTransactions()
      await (await this.adapterPromise).dispose()
    })
  }

  async ensureStarted(): Promise<[SqlDriverAdapter, TransactionManager]> {
    const adapter = await this.adapterPromise
    const transactionManager = await this.transactionManagerPromise
    await this.instantiateQueryCompilerPromise

    return [adapter, transactionManager]
  }

  version(): string {
    return 'unknown'
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
  async transaction(
    action: 'start' | 'commit' | 'rollback',
    _headers: Tx.TransactionHeaders,
    arg?: any,
  ): Promise<Tx.InteractiveTransactionInfo<undefined> | undefined> {
    let result: TransactionInfo | undefined

    const transactionManager = await this.transactionManagerPromise
    try {
      if (action === 'start') {
        const options: Tx.Options = arg
        result = await transactionManager.startTransaction(options)
      } else if (action === 'commit') {
        const txInfo: Tx.InteractiveTransactionInfo<undefined> = arg
        await transactionManager.commitTransaction(txInfo.id)
      } else if (action === 'rollback') {
        const txInfo: Tx.InteractiveTransactionInfo<undefined> = arg
        await transactionManager.rollbackTransaction(txInfo.id)
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
    // TODO: support traceparent
    { traceparent: _traceparent, interactiveTransaction }: RequestOptions<undefined>,
  ): Promise<{ data: T }> {
    debug(`sending request`)
    const queryStr = JSON.stringify(query)
    this.lastStartedQuery = queryStr

    const [adapter, transactionManager] = await this.ensureStarted().catch((err) => {
      throw this.#transformRequestError(err)
    })

    let queryPlanString: string
    try {
      queryPlanString = this.queryCompiler!.compile(queryStr)
    } catch (error) {
      throw this.#transformCompileError(error)
    }

    try {
      const queryPlan: QueryPlanNode = JSON.parse(queryPlanString)

      debug(`query plan created`, queryPlanString)

      const queryable = interactiveTransaction
        ? transactionManager.getTransaction(interactiveTransaction, 'query')
        : adapter

      const qiTransactionManager = (
        interactiveTransaction ? { enabled: false } : { enabled: true, manager: transactionManager }
      ) satisfies QueryInterpreterTransactionManager

      // TODO: ORM-508 - Implement query plan caching by replacing all scalar values in the query with params automatically.
      const placeholderValues = {}
      const interpreter = QueryInterpreter.forSql({
        transactionManager: qiTransactionManager,
        placeholderValues,
        onQuery: this.#emitQueryEvent,
        tracingHelper: this.tracingHelper,
      })
      const result = await interpreter.run(queryPlan, queryable)

      debug(`query plan executed`)

      return { data: { [query.action]: result } as T }
    } catch (e: any) {
      throw this.#transformRequestError(e)
    }
  }

  async requestBatch<T>(
    queries: JsonQuery[],
    { transaction, traceparent: _traceparent }: RequestBatchOptions<undefined>,
  ): Promise<BatchQueryEngineResult<T>[]> {
    if (queries.length === 0) {
      return []
    }
    const firstAction = queries[0].action

    const request = JSON.stringify(getBatchRequestPayload(queries, transaction))

    this.lastStartedQuery = request

    const [, transactionManager] = await this.ensureStarted().catch((err) => {
      throw this.#transformRequestError(err)
    })

    let batchResponse: BatchResponse
    try {
      batchResponse = this.queryCompiler!.compileBatch(request)
    } catch (err) {
      throw this.#transformCompileError(err)
    }

    try {
      let txInfo: InteractiveTransactionInfo<undefined>
      if (transaction?.kind === 'itx') {
        // If we are already in an interactive transaction we do not nest transactions
        txInfo = transaction.options
      } else {
        const txOptions = transaction?.options.isolationLevel
          ? { ...this.config.transactionOptions, isolationLevel: transaction.options.isolationLevel }
          : this.config.transactionOptions
        txInfo = await this.transaction('start', {}, txOptions)
      }

      // TODO: ORM-508 - Implement query plan caching by replacing all scalar values in the query with params automatically.
      const placeholderValues = {}
      const interpreter = QueryInterpreter.forSql({
        transactionManager: { enabled: false },
        placeholderValues,
        onQuery: this.#emitQueryEvent,
        tracingHelper: this.tracingHelper,
      })
      const queryable = transactionManager.getTransaction(txInfo, 'batch query')

      let results: BatchQueryEngineResult<unknown>[] = []
      switch (batchResponse.type) {
        case 'multi': {
          results = await Promise.all(
            batchResponse.plans.map(async (plan, i) => {
              const rows = await interpreter.run(plan as QueryPlanNode, queryable)
              return { data: { [queries[i].action]: rows } }
            }),
          )
          break
        }
        case 'compacted': {
          if (!queries.every((q) => q.action === firstAction)) {
            throw new Error('All queries in a batch must have the same action')
          }

          const rows = await interpreter.run(batchResponse.plan as QueryPlanNode, queryable)
          results = this.#convertCompactedRows(rows as {}[], batchResponse, firstAction)
          break
        }
      }

      if (transaction?.kind !== 'itx') {
        await this.transaction('commit', {}, txInfo)
      }

      return results as BatchQueryEngineResult<T>[]
    } catch (e: any) {
      throw this.#transformRequestError(e)
    }
  }

  metrics(options: MetricsOptionsJson): Promise<Metrics>
  metrics(options: MetricsOptionsPrometheus): Promise<string>
  metrics(_options: EngineMetricsOptions): Promise<Metrics | string> {
    throw new Error('Method not implemented.')
  }

  /**
   * Converts the result of a compacted query back to result objects analogous to what queries
   * would return when executed individually.
   */
  #convertCompactedRows(
    rows: {}[],
    response: CompactedBatchResponse,
    action: string,
  ): BatchQueryEngineResult<unknown>[] {
    // a list of objects that contain the keys of every row
    const keysPerRow = rows.map((item) =>
      response.keys.reduce((acc, key) => {
        acc[key] = item[key]
        return acc
      }, {}),
    )
    // the selections inferred from the request, used to filter unwanted columns from the results
    const selection = new Set(response.nestedSelection)

    return response.arguments.map((args) => {
      // we find the index of the row that matches the input arguments - this is the row we want
      // to return minus any extra columns not present in the selection
      const rowIndex = keysPerRow.findIndex((rowKeys) => doKeysMatch(rowKeys, args))
      if (rowIndex === -1) {
        if (response.expectNonEmpty) {
          return new PrismaClientKnownRequestError(
            'An operation failed because it depends on one or more records that were required but not found',
            {
              code: 'P2025',
              clientVersion: this.config.clientVersion,
            },
          )
        } else {
          return { data: { [action]: null } }
        }
      } else {
        const selected = Object.entries(rows[rowIndex]).filter(([k]) => selection.has(k))
        return { data: { [action]: Object.fromEntries(selected) } }
      }
    })
  }
}

function getErrorMessageWithLink(engine: ClientEngine, title: string) {
  return genericGetErrorMessageWithLink({
    binaryTarget: undefined,
    title,
    version: engine.config.clientVersion!,
    engineVersion: 'unknown', // WASM engines do not export their version info
    database: engine.config.activeProvider as any,
    query: engine.lastStartedQuery!,
  })
}

/**
 * Checks if two objects representing the names and values of key columns match. A match is
 * defined by one of the sets of keys being a subset of the other.
 */
function doKeysMatch(lhs: {}, rhs: {}): boolean {
  const lhsKeys = Object.keys(lhs)
  const rhsKeys = Object.keys(rhs)
  const smallerKeyList = lhsKeys.length < rhsKeys.length ? lhsKeys : rhsKeys
  return smallerKeyList.every((key) => isStrictDeepEqual(lhs[key], rhs[key]))
}

/**
 * Checks if two objects are deeply equal, recursively checking all properties for strict equality.
 */
function isStrictDeepEqual(a: unknown, b: unknown): boolean {
  return (
    a === b ||
    (a !== null &&
      b !== null &&
      typeof a === 'object' &&
      typeof b === 'object' &&
      Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every((key) => isStrictDeepEqual(a[key], b[key])))
  )
}
