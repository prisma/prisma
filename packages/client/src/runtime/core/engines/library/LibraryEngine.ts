import Debug from '@prisma/debug'
import type { Platform } from '@prisma/get-platform'
import { assertNodeAPISupported, getPlatform, platforms } from '@prisma/get-platform'
import { assertAlways, EngineSpanEvent } from '@prisma/internals'
import fs from 'fs'
import { bold, green, red, yellow } from 'kleur/colors'

import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { PrismaClientKnownRequestError } from '../../errors/PrismaClientKnownRequestError'
import { PrismaClientRustPanicError } from '../../errors/PrismaClientRustPanicError'
import { PrismaClientUnknownRequestError } from '../../errors/PrismaClientUnknownRequestError'
import { prismaGraphQLToJSError } from '../../errors/utils/prismaGraphQLToJSError'
import type { BatchQueryEngineResult, EngineConfig, RequestBatchOptions, RequestOptions } from '../common/Engine'
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
import { RequestError } from '../common/types/RequestError'
import type * as Tx from '../common/types/Transaction'
import { getBatchRequestPayload } from '../common/utils/getBatchRequestPayload'
import { getErrorMessageWithLink } from '../common/utils/getErrorMessageWithLink'
import { getInteractiveTransactionId } from '../common/utils/getInteractiveTransactionId'
import { DefaultLibraryLoader } from './DefaultLibraryLoader'
import type { Library, LibraryLoader, QueryEngineConstructor, QueryEngineInstance } from './types/Library'

const DRIVER_ADAPTER_EXTERNAL_ERROR = 'P2036'
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

const knownPlatforms: Platform[] = [...platforms, 'native']
let engineInstanceCount = 0

export class LibraryEngine extends Engine<undefined> {
  private engine?: QueryEngineInstance
  private libraryInstantiationPromise?: Promise<void>
  private libraryStartingPromise?: Promise<void>
  private libraryStoppingPromise?: Promise<void>
  private libraryStarted: boolean
  private executingQueryPromise?: Promise<any>
  private config: EngineConfig
  private QueryEngineConstructor?: QueryEngineConstructor
  private libraryLoader: LibraryLoader
  private library?: Library
  private logEmitter: LogEmitter
  libQueryEnginePath?: string
  platform?: Platform
  datasourceOverrides?: Record<string, string>
  datamodel: string
  logQueries: boolean
  logLevel: QueryEngineLogLevel
  lastQuery?: string
  loggerRustPanic?: any

  versionInfo?: {
    commit: string
    version: string
  }

  constructor(config: EngineConfig, loader: LibraryLoader = new DefaultLibraryLoader(config)) {
    super()

    try {
      // we try to handle the case where the datamodel is not found
      this.datamodel = fs.readFileSync(config.datamodelPath, 'utf-8')
    } catch (e) {
      if ((e.stack as string).match(/\/\.next|\/next@|\/next\//)) {
        throw new PrismaClientInitializationError(
          `Your schema.prisma could not be found, and we detected that you are using Next.js.
Find out why and learn how to fix this: https://pris.ly/d/schema-not-found-nextjs`,
          config.clientVersion!,
        )
      } else if (config.isBundled === true) {
        throw new PrismaClientInitializationError(
          `Prisma Client could not find its \`schema.prisma\`. This is likely caused by a bundling step, which leads to \`schema.prisma\` not being copied near the resulting bundle. We would appreciate if you could take the time to share some information with us.
Please help us by answering a few questions: https://pris.ly/bundler-investigation-error`,
          config.clientVersion!,
        )
      }

      throw e
    }

    this.config = config
    this.libraryStarted = false
    this.logQueries = config.logQueries ?? false
    this.logLevel = config.logLevel ?? 'error'
    this.libraryLoader = loader
    this.logEmitter = config.logEmitter
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

    this.checkForTooManyEngines()
  }

  private checkForTooManyEngines() {
    if (engineInstanceCount === 10) {
      console.warn(
        `${yellow(
          'warn(prisma-client)',
        )} This is the 10th instance of Prisma Client being started. Make sure this is intentional.`,
      )
    }
  }

  async transaction(
    action: 'start',
    headers: Tx.TransactionHeaders,
    options?: Tx.Options,
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
        max_wait: arg?.maxWait ?? 2000, // default
        timeout: arg?.timeout ?? 5000, // default
        isolation_level: arg?.isolationLevel,
      })

      result = await this.engine?.startTransaction(jsonOptions, headerStr)
    } else if (action === 'commit') {
      result = await this.engine?.commitTransaction(arg.id, headerStr)
    } else if (action === 'rollback') {
      result = await this.engine?.rollbackTransaction(arg.id, headerStr)
    }

    const response = this.parseEngineResponse<{ [K: string]: unknown }>(result)

    if (response.error_code) {
      throw new PrismaClientKnownRequestError(response.message as string, {
        code: response.error_code as string,
        clientVersion: this.config.clientVersion as string,
        meta: response.meta as Record<string, unknown>,
      })
    }

    return response as Tx.InteractiveTransactionInfo<undefined> | undefined
  }

  private async instantiateLibrary(): Promise<void> {
    debug('internalSetup')
    if (this.libraryInstantiationPromise) {
      return this.libraryInstantiationPromise
    }

    assertNodeAPISupported()
    this.platform = await this.getPlatform()
    await this.loadEngine()
    this.version()
  }

  private async getPlatform() {
    if (this.platform) return this.platform
    const platform = await getPlatform()
    if (!knownPlatforms.includes(platform)) {
      throw new PrismaClientInitializationError(
        `Unknown ${red('PRISMA_QUERY_ENGINE_LIBRARY')} ${red(bold(platform))}. Possible binaryTargets: ${green(
          knownPlatforms.join(', '),
        )} or a path to the query engine library.
You may have to run ${green('prisma generate')} for your changes to take effect.`,
        this.config.clientVersion!,
      )
    }
    return platform
  }

  private parseEngineResponse<T>(response?: string): T {
    if (!response) {
      throw new PrismaClientUnknownRequestError(`Response from the Engine was empty`, {
        clientVersion: this.config.clientVersion!,
      })
    }
    try {
      const config = JSON.parse(response)
      return config as T
    } catch (err) {
      throw new PrismaClientUnknownRequestError(`Unable to JSON.parse response from engine`, {
        clientVersion: this.config.clientVersion!,
      })
    }
  }

  private async loadEngine(): Promise<void> {
    if (!this.engine) {
      if (!this.QueryEngineConstructor) {
        this.library = await this.libraryLoader.loadLibrary()
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

        this.engine = new this.QueryEngineConstructor(
          {
            datamodel: this.datamodel,
            env: process.env,
            logQueries: this.config.logQueries ?? false,
            ignoreEnvVarErrors: true,
            datasourceOverrides: this.datasourceOverrides ?? {},
            logLevel: this.logLevel,
            configDir: this.config.cwd,
            engineProtocol: 'json',
          },
          (log) => {
            weakThis.deref()?.logger(log)
          },
          adapter,
        )
        engineInstanceCount++
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
  }

  private logger(log: string) {
    const event = this.parseEngineResponse<QueryEngineEvent | null>(log)
    if (!event) return

    if ('span' in event) {
      void this.config.tracingHelper.createEngineSpan(event as EngineSpanEvent)

      return
    }

    event.level = event?.level.toLowerCase() ?? 'unknown'
    if (isQueryEvent(event)) {
      this.logEmitter.emit('query', {
        timestamp: new Date(),
        query: event.query,
        params: event.params,
        duration: Number(event.duration_ms),
        target: event.module_path,
      })
    } else if (isPanicEvent(event)) {
      // The error built is saved to be thrown later
      this.loggerRustPanic = new PrismaClientRustPanicError(
        this.getErrorMessageWithLink(
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

  private getErrorMessageWithLink(title: string) {
    return getErrorMessageWithLink({
      platform: this.platform,
      title,
      version: this.config.clientVersion!,
      engineVersion: this.versionInfo?.commit,
      database: this.config.activeProvider as any,
      query: this.lastQuery!,
    })
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

  override onBeforeExit() {
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
          traceparent: this.config.tracingHelper.getTraceParent(),
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

    this.libraryStartingPromise = this.config.tracingHelper.runInChildSpan('connect', startFn)

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
        traceparent: this.config.tracingHelper.getTraceParent(),
      }

      await this.engine?.disconnect(JSON.stringify(headers))

      this.libraryStarted = false
      this.libraryStoppingPromise = undefined

      debug('library stopped')
    }

    this.libraryStoppingPromise = this.config.tracingHelper.runInChildSpan('disconnect', stopFn)

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
  ): Promise<{ data: T; elapsed: number }> {
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
      } else if (this.loggerRustPanic) {
        throw this.loggerRustPanic
      }
      // TODO Implement Elapsed: https://github.com/prisma/prisma/issues/7726
      return { data, elapsed: 0 }
    } catch (e: any) {
      if (e instanceof PrismaClientInitializationError) {
        throw e
      }
      if (e.code === 'GenericFailure' && e.message?.startsWith('PANIC:')) {
        throw new PrismaClientRustPanicError(this.getErrorMessageWithLink(e.message), this.config.clientVersion!)
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
          elapsed: 0, // TODO Implement Elapsed: https://github.com/prisma/prisma/issues/7726
        }
      })
    } else {
      if (errors && errors.length === 1) {
        throw new Error(errors[0].error)
      }
      throw new Error(JSON.stringify(data))
    }
  }

  private buildQueryError(error: RequestError) {
    if (error.user_facing_error.is_panic) {
      return new PrismaClientRustPanicError(
        this.getErrorMessageWithLink(error.user_facing_error.message),
        this.config.clientVersion!,
      )
    }

    if (error.user_facing_error.error_code === DRIVER_ADAPTER_EXTERNAL_ERROR && this.config.adapter) {
      const id = error.user_facing_error.meta?.id
      assertAlways(typeof id === 'number', 'Malformed external JS error received from the engine')
      const errorRecord = this.config.adapter.errorRegistry.consumeError(id)
      assertAlways(errorRecord, `External error with reported id was not registered`)
      return errorRecord.error
    }

    return prismaGraphQLToJSError(error, this.config.clientVersion!)
  }

  async metrics(options: MetricsOptionsJson): Promise<Metrics>
  async metrics(options: MetricsOptionsPrometheus): Promise<string>
  async metrics(options: EngineMetricsOptions): Promise<Metrics | string> {
    await this.start()
    const responseString = await this.engine!.metrics(JSON.stringify(options))
    if (options.format === 'prometheus') {
      return responseString
    }
    return this.parseEngineResponse(responseString)
  }
}
