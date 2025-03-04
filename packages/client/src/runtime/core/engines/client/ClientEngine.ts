import {
  type QueryEvent,
  QueryInterpreter,
  type QueryPlanNode,
  type TransactionInfo,
  TransactionManager,
  TransactionManagerError,
} from '@prisma/client-engine-runtime'
import Debug from '@prisma/debug'
import type { ErrorCapturingDriverAdapter } from '@prisma/driver-adapter-utils'
import { assertNever, type TracingHelper } from '@prisma/internals'

import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { PrismaClientKnownRequestError } from '../../errors/PrismaClientKnownRequestError'
import { PrismaClientRustPanicError } from '../../errors/PrismaClientRustPanicError'
import { PrismaClientUnknownRequestError } from '../../errors/PrismaClientUnknownRequestError'
import type { BatchQueryEngineResult, EngineConfig, RequestBatchOptions, RequestOptions } from '../common/Engine'
import type { Engine } from '../common/Engine'
import type { LogEmitter, QueryEvent as ClientQueryEvent } from '../common/types/Events'
import type { JsonQuery } from '../common/types/JsonProtocol'
import type { EngineMetricsOptions, Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from '../common/types/Metrics'
import type {
  QueryEngineLogLevel,
  QueryEngineResultData,
  RustRequestError,
  SyncRustError,
} from '../common/types/QueryEngine'
import type * as Tx from '../common/types/Transaction'
import type { InteractiveTransactionInfo } from '../common/types/Transaction'
import { getErrorMessageWithLink as genericGetErrorMessageWithLink } from '../common/utils/getErrorMessageWithLink'
import type { QueryCompiler, QueryCompilerConstructor, QueryCompilerLoader } from './types/QueryCompiler'
import { wasmQueryCompilerLoader } from './WasmQueryCompilerLoader'

const CLIENT_ENGINE_ERROR = 'P2038'

const debug = Debug('prisma:client:clientEngine')

export class ClientEngine implements Engine<undefined> {
  name = 'ClientEngine' as const

  queryCompiler?: QueryCompiler
  instantiateQueryCompilerPromise: Promise<void>
  QueryCompilerConstructor?: QueryCompilerConstructor
  queryCompilerLoader: QueryCompilerLoader

  config: EngineConfig
  datamodel: string

  driverAdapter: ErrorCapturingDriverAdapter
  transactionManager: TransactionManager

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
    const { adapter } = config
    if (!adapter) {
      throw new PrismaClientInitializationError(
        'Missing configured driver adapter. Engine type `client` requires an active driver adapter. Please check your PrismaClient initialization code.',
        config.clientVersion!,
        CLIENT_ENGINE_ERROR,
      )
    }
      this.driverAdapter = adapter
      debug('Using driver adapter: %O', adapter)

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

    this.transactionManager = new TransactionManager({
      driverAdapter: this.driverAdapter,
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
        provider: this.driverAdapter.provider,
        connectionInfo: {},
      })
    } catch (e) {
      throw this.transformInitError(e)
    }
  }

  private transformInitError(err: Error): Error {
    try {
      const error: SyncRustError = JSON.parse(err.message)
      return new PrismaClientInitializationError(error.message, this.config.clientVersion!, error.error_code)
    } catch (_e) {
      return err
    }
  }

  private transformRequestError(err: any): Error {
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
    } catch (_e) {
      return err
    }
  }

  onBeforeExit() {
    throw new Error(
      '"beforeExit" hook is not applicable to the client engine, it is only relevant and implemented for the binary engine. Please add your event listener to the `process` object directly instead.',
    )
  }

  async start(): Promise<void> {
    await this.instantiateQueryCompilerPromise
  }

  async stop(): Promise<void> {
    await this.instantiateQueryCompilerPromise
    await this.transactionManager.cancelAllTransactions()
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

    try {
      if (action === 'start') {
        const options: Tx.Options = arg
        result = await this.transactionManager.startTransaction(options)
      } else if (action === 'commit') {
        const txInfo: Tx.InteractiveTransactionInfo<undefined> = arg
        await this.transactionManager.commitTransaction(txInfo.id)
      } else if (action === 'rollback') {
        const txInfo: Tx.InteractiveTransactionInfo<undefined> = arg
        await this.transactionManager.rollbackTransaction(txInfo.id)
      } else {
        assertNever(action, 'Invalid transaction action.')
      }
    } catch (error) {
      throw this.transformRequestError(error)
    }

    return result ? { id: result.id, payload: undefined } : undefined
  }

  async request<T>(
    query: JsonQuery,
    // TODO: support traceparent
    { traceparent: _traceparent, interactiveTransaction }: RequestOptions<undefined>,
  ): Promise<{ data: T }> {
    debug('sending request')
    const queryStr = JSON.stringify(query)
    this.lastStartedQuery = queryStr

    try {
      await this.start()

      const queryPlanString = await this.queryCompiler!.compile(queryStr)
      const queryPlan: QueryPlanNode = JSON.parse(queryPlanString)

      debug('query plan created', queryPlanString)

      const queryable = interactiveTransaction
        ? this.transactionManager.getTransaction(interactiveTransaction, query.action)
        : this.driverAdapter

      // TODO: ORM-508 - Implement query plan caching by replacing all scalar values in the query with params automatically.
      const placeholderValues = {}
      const interpreter = new QueryInterpreter({
        queryable,
        placeholderValues,
        onQuery: this.#emitQueryEvent,
      })
      const result = await interpreter.run(queryPlan)

      debug('query plan executed')

      return { data: { [query.action]: result } as T }
    } catch (e: any) {
      throw this.transformRequestError(e)
    }
  }

  async requestBatch<T>(
    queries: JsonQuery[],
    { transaction, traceparent: _traceparent }: RequestBatchOptions<undefined>,
  ): Promise<BatchQueryEngineResult<T>[]> {
    this.lastStartedQuery = JSON.stringify(queries)

    try {
      await this.start()

      const queriesWithPlans = await Promise.all(
        queries.map(async (query) => {
          const queryStr = JSON.stringify(query)
          const queryPlanString = await this.queryCompiler!.compile(queryStr)
          return { query, plan: JSON.parse(queryPlanString) as QueryPlanNode }
        }),
      )

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

      // TODO: potentially could run batch queries in parallel if it's for sure not in a transaction
      const results: BatchQueryEngineResult<T>[] = []
      for (const { query, plan } of queriesWithPlans) {
        const queryable = this.transactionManager.getTransaction(txInfo, query.action)
        const interpreter = new QueryInterpreter({
          queryable,
          placeholderValues: {},
          onQuery: this.#emitQueryEvent,
        })
        results.push((await interpreter.run(plan)) as QueryEngineResultData<T>)
      }

      if (transaction?.kind !== 'itx') {
        await this.transaction('commit', {}, txInfo)
      }

      return results
    } catch (e: any) {
      throw this.transformRequestError(e)
    }
  }

  metrics(options: MetricsOptionsJson): Promise<Metrics>
  metrics(options: MetricsOptionsPrometheus): Promise<string>
  metrics(_options: EngineMetricsOptions): Promise<Metrics | string> {
    throw new Error('Method not implemented.')
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
