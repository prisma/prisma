import Debug from '@prisma/debug'
import { DMMF } from '@prisma/generator-helper'
import type { Platform } from '@prisma/get-platform'
import { getPlatform, isNodeAPISupported, platforms } from '@prisma/get-platform'
import chalk from 'chalk'
import EventEmitter from 'events'
import fs from 'fs'

import { createSpan, EngineSpanEvent } from '../../../client/src/runtime/utils/otel/runInChildSpan'
import type { DatasourceOverwrite, EngineConfig, EngineEventType } from '../common/Engine'
import { Engine } from '../common/Engine'
import { PrismaClientInitializationError } from '../common/errors/PrismaClientInitializationError'
import { PrismaClientRustPanicError } from '../common/errors/PrismaClientRustPanicError'
import { PrismaClientUnknownRequestError } from '../common/errors/PrismaClientUnknownRequestError'
import { RequestError } from '../common/errors/types/RequestError'
import { getErrorMessageWithLink } from '../common/errors/utils/getErrorMessageWithLink'
import { prismaGraphQLToJSError } from '../common/errors/utils/prismaGraphQLToJSError'
import { EngineMetricsOptions, Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from '../common/types/Metrics'
import type {
  ConfigMetaFormat,
  QueryEngineBatchRequest,
  QueryEngineEvent,
  QueryEngineLogLevel,
  QueryEnginePanicEvent,
  QueryEngineQueryEvent,
  QueryEngineRequest,
  QueryEngineRequestHeaders,
  QueryEngineResult,
  RustRequestError,
  SyncRustError,
} from '../common/types/QueryEngine'
import type * as Tx from '../common/types/Transaction'
import { DefaultLibraryLoader } from './DefaultLibraryLoader'
import type { Library, LibraryLoader, QueryEngineConstructor, QueryEngineInstance } from './types/Library'

const debug = Debug('prisma:client:libraryEngine')

function isQueryEvent(event: QueryEngineEvent): event is QueryEngineQueryEvent {
  return event['item_type'] === 'query' && 'query' in event
}
function isPanicEvent(event: QueryEngineEvent): event is QueryEnginePanicEvent {
  return event.level === 'error' && event['message'] === 'PANIC'
}

const knownPlatforms: Platform[] = [...platforms, 'native']
const engines: LibraryEngine[] = []

export class LibraryEngine extends Engine {
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
  private logEmitter: EventEmitter
  libQueryEnginePath?: string
  platform?: Platform
  datasourceOverrides: Record<string, string>
  datamodel: string
  logQueries: boolean
  logLevel: QueryEngineLogLevel
  lastQuery?: string
  loggerRustPanic?: any

  beforeExitListener?: (args?: any) => any
  versionInfo?: {
    commit: string
    version: string
  }

  constructor(config: EngineConfig, loader: LibraryLoader = new DefaultLibraryLoader(config)) {
    super()

    this.datamodel = fs.readFileSync(config.datamodelPath, 'utf-8')
    this.config = config
    this.libraryStarted = false
    this.logQueries = config.logQueries ?? false
    this.logLevel = config.logLevel ?? 'error'
    this.libraryLoader = loader
    this.logEmitter = new EventEmitter()
    this.logEmitter.on('error', (e) => {
      // to prevent unhandled error events
      // TODO: should we actually handle them instead of silently swallowing?
    })
    this.datasourceOverrides = config.datasources ? this.convertDatasources(config.datasources) : {}
    if (config.enableDebugLogs) {
      this.logLevel = 'debug'
      // Debug.enable('*')
    }
    this.libraryInstantiationPromise = this.instantiateLibrary()

    initHooks()
    engines.push(this)
    this.checkForTooManyEngines()
  }

  private checkForTooManyEngines() {
    if (engines.length >= 10) {
      const runningEngines = engines.filter((e) => e.engine)
      if (runningEngines.length === 10) {
        console.warn(
          `${chalk.yellow('warn(prisma-client)')} There are already 10 instances of Prisma Client actively running.`,
        )
      }
    }
  }

  //@ts-ignore
  async transaction(action: 'start', headers: string, options?: Tx.Options): Promise<Tx.Info>
  //@ts-ignore
  async transaction(action: 'commit', headers: string, info: Tx.Info): Promise<undefined>
  //@ts-ignore
  async transaction(action: 'rollback', headers: string, info: Tx.Info): Promise<undefined>
  //@ts-ignore
  async transaction(action: any, headers: string, arg?: any) {
    await this.start()

    let result: string | undefined
    if (action === 'start') {
      const jsonOptions = JSON.stringify({
        max_wait: arg?.maxWait ?? 2000, // default
        timeout: arg?.timeout ?? 5000, // default
      })

      result = await this.engine?.startTransaction(jsonOptions, headers)
    } else if (action === 'commit') {
      result = await this.engine?.commitTransaction(arg.id, headers)
    } else if (action === 'rollback') {
      result = await this.engine?.rollbackTransaction(arg.id, headers)
    }

    const response = this.parseEngineResponse<{ [K: string]: unknown }>(result)

    if (response.error_code) throw response

    return response as Tx.Info | undefined
  }

  private async instantiateLibrary(): Promise<void> {
    debug('internalSetup')
    if (this.libraryInstantiationPromise) {
      return this.libraryInstantiationPromise
    }

    await isNodeAPISupported()
    this.platform = await this.getPlatform()
    await this.loadEngine()
    this.version()
  }

  private async getPlatform() {
    if (this.platform) return this.platform
    const platform = await getPlatform()
    if (!knownPlatforms.includes(platform)) {
      throw new PrismaClientInitializationError(
        `Unknown ${chalk.red('PRISMA_QUERY_ENGINE_LIBRARY')} ${chalk.redBright.bold(
          platform,
        )}. Possible binaryTargets: ${chalk.greenBright(
          knownPlatforms.join(', '),
        )} or a path to the query engine library.
You may have to run ${chalk.greenBright('prisma generate')} for your changes to take effect.`,
        this.config.clientVersion!,
      )
    }
    return platform
  }

  private parseEngineResponse<T>(response?: string): T {
    if (!response) {
      throw new PrismaClientUnknownRequestError(`Response from the Engine was empty`, this.config.clientVersion!)
    }
    try {
      const config = JSON.parse(response)
      return config as T
    } catch (err) {
      throw new PrismaClientUnknownRequestError(`Unable to JSON.parse response from engine`, this.config.clientVersion!)
    }
  }

  private convertDatasources(datasources: DatasourceOverwrite[]): Record<string, string> {
    const obj = Object.create(null)
    for (const { name, url } of datasources) {
      obj[name] = url
    }
    return obj
  }

  private async loadEngine(): Promise<void> {
    if (!this.engine) {
      if (!this.QueryEngineConstructor) {
        this.library = await this.libraryLoader.loadLibrary()
        this.QueryEngineConstructor = this.library.QueryEngine
      }
      try {
        this.engine = new this.QueryEngineConstructor(
          {
            datamodel: this.datamodel,
            env: process.env,
            logQueries: this.config.logQueries ?? false,
            ignoreEnvVarErrors: false,
            datasourceOverrides: this.datasourceOverrides,
            logLevel: this.logLevel,
            configDir: this.config.cwd!,
          },
          (err, log) => this.logger(err, log),
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
  }

  private logger(err: string, log: string) {
    if (err) {
      throw err
    }
    const event = this.parseEngineResponse<QueryEngineEvent | null>(log)
    if (!event) return

    // @ts-ignore
    if (event?.span === true) {
      //@ts-ignore TODO: Get the type conversion correct;
      createSpan(event as EngineSpanEvent)

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
      this.loggerRustPanic = new PrismaClientRustPanicError(
        this.getErrorMessageWithLink(
          `${event.message}: ${event.reason} in ${event.file}:${event.line}:${event.column}`,
        ),
        this.config.clientVersion!,
      )
      this.logEmitter.emit('error', this.loggerRustPanic)
    } else {
      this.logEmitter.emit(event.level, {
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

  on(event: EngineEventType, listener: (args?: any) => any): void {
    if (event === 'beforeExit') {
      this.beforeExitListener = listener
    } else {
      this.logEmitter.on(event, listener)
    }
  }

  async runBeforeExit() {
    debug('runBeforeExit')
    if (this.beforeExitListener) {
      try {
        await this.beforeExitListener()
      } catch (e) {
        console.error(e)
      }
    }
  }

  async start(): Promise<void> {
    await this.libraryInstantiationPromise
    await this.libraryStoppingPromise
    if (this.libraryStartingPromise) {
      debug(`library already starting, this.libraryStarted: ${this.libraryStarted}`)
      return this.libraryStartingPromise
    }
    if (!this.libraryStarted) {
      this.libraryStartingPromise = new Promise((resolve, reject) => {
        debug('library starting')
        this.engine
          ?.connect({ enableRawQueries: true })
          .then(() => {
            this.libraryStarted = true
            debug('library started')
            resolve()
          })
          .catch((err) => {
            const error = this.parseInitError(err.message)
            // The error message thrown by the query engine should be a stringified JSON
            // if parsing fails then we just reject the error
            if (typeof error === 'string') {
              reject(err)
            } else {
              reject(new PrismaClientInitializationError(error.message, this.config.clientVersion!, error.error_code))
            }
          })
          .finally(() => {
            this.libraryStartingPromise = undefined
          })
      })
      return this.libraryStartingPromise
    }
  }

  async stop(): Promise<void> {
    await this.libraryStartingPromise
    await this.executingQueryPromise
    if (this.libraryStoppingPromise) {
      debug('library is already stopping')
      return this.libraryStoppingPromise
    }

    if (this.libraryStarted) {
      // eslint-disable-next-line no-async-promise-executor
      this.libraryStoppingPromise = new Promise(async (resolve, reject) => {
        try {
          await new Promise((r) => setTimeout(r, 5))
          debug('library stopping')
          await this.engine?.disconnect()
          this.libraryStarted = false
          this.libraryStoppingPromise = undefined
          debug('library stopped')
          resolve()
        } catch (err) {
          reject(err)
        }
      })
      return this.libraryStoppingPromise
    }
  }

  async getConfig(): Promise<ConfigMetaFormat> {
    await this.libraryInstantiationPromise

    return this.library!.getConfig({
      datamodel: this.datamodel,
      datasourceOverrides: this.datasourceOverrides,
      ignoreEnvVarErrors: true,
      env: process.env,
    })
  }

  async getDmmf(): Promise<DMMF.Document> {
    await this.libraryInstantiationPromise

    return JSON.parse(await this.library!.dmmf(this.datamodel))
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
    query: string,
    headers: QueryEngineRequestHeaders = {},
    numTry = 1,
  ): Promise<{ data: T; elapsed: number }> {
    debug(`sending request, this.libraryStarted: ${this.libraryStarted}`)
    const request: QueryEngineRequest = { query, variables: {} }
    const headerStr = JSON.stringify(headers) // object equivalent to http headers for the library
    const queryStr = JSON.stringify(request)

    try {
      await this.start()
      this.executingQueryPromise = this.engine?.query(queryStr, headerStr, headers.transactionId)

      this.lastQuery = queryStr
      const data = this.parseEngineResponse<any>(await this.executingQueryPromise)

      if (data.errors) {
        if (data.errors.length === 1) {
          throw this.buildQueryError(data.errors[0])
        }
        // this case should not happen, as the query engine only returns one error
        throw new PrismaClientUnknownRequestError(JSON.stringify(data.errors), this.config.clientVersion!)
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
        throw new PrismaClientUnknownRequestError(`${error.message}\n${error.backtrace}`, this.config.clientVersion!)
      }
    }
  }

  async requestBatch<T>(
    queries: string[],
    headers: QueryEngineRequestHeaders = {},
    transaction = false,
    numTry = 1,
  ): Promise<QueryEngineResult<T>[]> {
    debug('requestBatch')
    const request: QueryEngineBatchRequest = {
      batch: queries.map((query) => ({ query, variables: {} })),
      transaction,
    }
    await this.start()

    this.lastQuery = JSON.stringify(request)
    this.executingQueryPromise = this.engine!.query(this.lastQuery, JSON.stringify(headers), headers.transactionId)
    const result = await this.executingQueryPromise
    const data = this.parseEngineResponse<any>(result)

    if (data.errors) {
      if (data.errors.length === 1) {
        throw this.buildQueryError(data.errors[0])
      }
      // this case should not happen, as the query engine only returns one error
      throw new PrismaClientUnknownRequestError(JSON.stringify(data.errors), this.config.clientVersion!)
    }

    const { batchResult, errors } = data
    if (Array.isArray(batchResult)) {
      return batchResult.map((result) => {
        if (result.errors) {
          return this.loggerRustPanic ?? this.buildQueryError(data.errors[0])
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

function hookProcess(handler: string, exit = false) {
  process.once(handler as any, async () => {
    debug(`hookProcess received: ${handler}`)
    for (const engine of engines) {
      await engine.runBeforeExit()
    }
    engines.splice(0, engines.length)
    // only exit, if only we are listening
    // if there is another listener, that other listener is responsible
    if (exit && process.listenerCount(handler) === 0) {
      process.exit()
    }
  })
}
let hooksInitialized = false
function initHooks() {
  if (!hooksInitialized) {
    hookProcess('beforeExit')
    hookProcess('exit')
    hookProcess('SIGINT', true)
    hookProcess('SIGUSR2', true)
    hookProcess('SIGTERM', true)
    hooksInitialized = true
  }
}
