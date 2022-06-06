import Debug from '@prisma/debug'
import { getEnginesPath } from '@prisma/engines'
import type { Platform } from '@prisma/get-platform'
import { getNodeAPIName, getPlatform, isNodeAPISupported, platforms } from '@prisma/get-platform'
import chalk from 'chalk'
import EventEmitter from 'events'
import fs from 'fs'
import path from 'path'

import type { DatasourceOverwrite, EngineConfig, EngineEventType } from '../common/Engine'
import { Engine } from '../common/Engine'
import { PrismaClientInitializationError } from '../common/errors/PrismaClientInitializationError'
import { PrismaClientRustPanicError } from '../common/errors/PrismaClientRustPanicError'
import { PrismaClientUnknownRequestError } from '../common/errors/PrismaClientUnknownRequestError'
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
import { printGeneratorConfig } from '../common/utils/printGeneratorConfig'
import { fixBinaryTargets } from '../common/utils/util'
import type { Library, QueryEngineConstructor, QueryEngineInstance } from './types/Library'

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

  constructor(config: EngineConfig) {
    super()

    this.datamodel = fs.readFileSync(config.datamodelPath, 'utf-8')
    this.config = config
    this.libraryStarted = false
    this.logQueries = config.logQueries ?? false
    this.logLevel = config.logLevel ?? 'error'
    this.logEmitter = new EventEmitter()
    this.logEmitter.on('error', (e) => {
      // to prevent unhandled error events
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
  async transaction(action: 'start', options?: Tx.Options): Promise<Tx.Info>
  async transaction(action: 'commit', info: Tx.Info): Promise<undefined>
  async transaction(action: 'rollback', info: Tx.Info): Promise<undefined>
  async transaction(action: any, arg?: any) {
    await this.start()

    let result: string | undefined
    if (action === 'start') {
      const jsonOptions = JSON.stringify({
        max_wait: arg?.maxWait ?? 2000, // default
        timeout: arg?.timeout ?? 5000, // default
      })

      result = await this.engine?.startTransaction(jsonOptions, '{}')
    } else if (action === 'commit') {
      result = await this.engine?.commitTransaction(arg.id, '{}')
    } else if (action === 'rollback') {
      result = await this.engine?.rollbackTransaction(arg.id, '{}')
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
    if (!this.libQueryEnginePath) {
      this.libQueryEnginePath = await this.getLibQueryEnginePath()
    }
    debug(`loadEngine using ${this.libQueryEnginePath}`)
    if (!this.engine) {
      if (!this.QueryEngineConstructor) {
        try {
          // this require needs to be resolved at runtime, tell webpack to ignore it
          this.library = eval('require')(this.libQueryEnginePath) as Library
          this.QueryEngineConstructor = this.library.QueryEngine
        } catch (e) {
          if (fs.existsSync(this.libQueryEnginePath)) {
            if (this.libQueryEnginePath.endsWith('.node')) {
              throw new PrismaClientInitializationError(
                `Unable to load Node-API Library from ${chalk.dim(this.libQueryEnginePath)}, Library may be corrupt`,
                this.config.clientVersion!,
              )
            } else {
              throw new PrismaClientInitializationError(
                `Expected an Node-API Library but received ${chalk.dim(this.libQueryEnginePath)}`,
                this.config.clientVersion!,
              )
            }
          } else {
            throw new PrismaClientInitializationError(
              `Unable to load Node-API Library from ${chalk.dim(this.libQueryEnginePath)}, It does not exist`,
              this.config.clientVersion!,
            )
          }
        }
      }
      if (this.QueryEngineConstructor) {
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
  }

  private logger(err: string, log: string) {
    if (err) {
      throw err
    }
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

  getConfig(): Promise<ConfigMetaFormat> {
    return this.library!.getConfig({
      datamodel: this.datamodel,
      datasourceOverrides: this.datasourceOverrides,
      ignoreEnvVarErrors: true,
      env: process.env,
    })
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
          throw prismaGraphQLToJSError(data.errors[0], this.config.clientVersion!)
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
        throw prismaGraphQLToJSError(data.errors[0], this.config.clientVersion!)
      }
      // this case should not happen, as the query engine only returns one error
      throw new PrismaClientUnknownRequestError(JSON.stringify(data.errors), this.config.clientVersion!)
    }

    const { batchResult, errors } = data
    if (Array.isArray(batchResult)) {
      return batchResult.map((result) => {
        if (result.errors) {
          return this.loggerRustPanic ?? prismaGraphQLToJSError(data.errors[0], this.config.clientVersion!)
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

  private async resolveEnginePath(): Promise<{
    enginePath: string
    searchedLocations: string[]
  }> {
    const searchedLocations: string[] = []
    let enginePath
    if (this.libQueryEnginePath) {
      return { enginePath: this.libQueryEnginePath, searchedLocations }
    }

    this.platform = this.platform ?? (await getPlatform())

    // TODO Why special case dependent on file name?
    if (__filename.includes('LibraryEngine')) {
      enginePath = path.join(getEnginesPath(), getNodeAPIName(this.platform, 'fs'))
      return { enginePath, searchedLocations }
    }
    const searchLocations: string[] = [
      eval(`require('path').join(__dirname, '../../../.prisma/client')`), // Dot Prisma Path
      this.config.generator?.output?.value ?? eval('__dirname'), // Custom Generator Path
      path.join(eval('__dirname'), '..'), // parentDirName
      path.dirname(this.config.datamodelPath), // Datamodel Dir
      this.config.cwd, //cwdPath
      '/tmp/prisma-engines',
    ]

    if (this.config.dirname) {
      searchLocations.push(this.config.dirname)
    }

    for (const location of searchLocations) {
      searchedLocations.push(location)
      debug(`Searching for Query Engine Library in ${location}`)
      enginePath = path.join(location, getNodeAPIName(this.platform, 'fs'))
      if (fs.existsSync(enginePath)) {
        return { enginePath, searchedLocations }
      }
    }
    enginePath = path.join(__dirname, getNodeAPIName(this.platform, 'fs'))

    return { enginePath: enginePath ?? '', searchedLocations }
  }

  private async getLibQueryEnginePath(): Promise<string> {
    // TODO Document ENV VAR
    const libPath = process.env.PRISMA_QUERY_ENGINE_LIBRARY ?? this.config.prismaPath
    if (libPath && fs.existsSync(libPath) && libPath.endsWith('.node')) {
      return libPath
    }
    this.platform = this.platform ?? (await getPlatform())
    const { enginePath, searchedLocations } = await this.resolveEnginePath()
    // If path to query engine doesn't exist, throw
    if (!fs.existsSync(enginePath)) {
      const incorrectPinnedPlatformErrorStr = this.platform
        ? `\nYou incorrectly pinned it to ${chalk.redBright.bold(`${this.platform}`)}\n`
        : ''
      // TODO Improve search engine logic possibly using findSync
      let errorText = `Query engine library for current platform "${chalk.bold(
        this.platform,
      )}" could not be found.${incorrectPinnedPlatformErrorStr}
This probably happens, because you built Prisma Client on a different platform.
(Prisma Client looked in "${chalk.underline(enginePath)}")

Searched Locations:

${searchedLocations
  .map((f) => {
    let msg = `  ${f}`
    if (process.env.DEBUG === 'node-engine-search-locations' && fs.existsSync(f)) {
      const dir = fs.readdirSync(f)
      msg += dir.map((d) => `    ${d}`).join('\n')
    }
    return msg
  })
  .join('\n' + (process.env.DEBUG === 'node-engine-search-locations' ? '\n' : ''))}\n`
      // The generator should always be there during normal usage
      if (this.config.generator) {
        // The user already added it, but it still doesn't work 🤷‍♀️
        // That means, that some build system just deleted the files 🤔
        this.platform = this.platform ?? (await getPlatform())
        if (
          this.config.generator.binaryTargets.find((object) => object.value === this.platform!) ||
          this.config.generator.binaryTargets.find((object) => object.value === 'native')
        ) {
          errorText += `
You already added the platform${
            this.config.generator.binaryTargets.length > 1 ? 's' : ''
          } ${this.config.generator.binaryTargets
            .map((t) => `"${chalk.bold(t.value)}"`)
            .join(', ')} to the "${chalk.underline('generator')}" block
in the "schema.prisma" file as described in https://pris.ly/d/client-generator,
but something went wrong. That's suboptimal.

Please create an issue at https://github.com/prisma/prisma/issues/new`
          errorText += ``
        } else {
          // If they didn't even have the current running platform in the schema.prisma file, it's easy
          // Just add it
          errorText += `\n\nTo solve this problem, add the platform "${this.platform}" to the "${chalk.underline(
            'binaryTargets',
          )}" attribute in the "${chalk.underline('generator')}" block in the "schema.prisma" file:
${chalk.greenBright(this.getFixedGenerator())}

Then run "${chalk.greenBright('prisma generate')}" for your changes to take effect.
Read more about deploying Prisma Client: https://pris.ly/d/client-generator`
        }
      } else {
        errorText += `\n\nRead more about deploying Prisma Client: https://pris.ly/d/client-generator\n`
      }

      throw new PrismaClientInitializationError(errorText, this.config.clientVersion!)
    }
    this.platform = this.platform ?? (await getPlatform())
    return enginePath
  }

  // TODO Fixed as in "not broken" or fixed as in "written down"? If any of these, why and how and where?
  private getFixedGenerator(): string {
    const fixedGenerator = {
      ...this.config.generator!,
      binaryTargets: fixBinaryTargets(this.config.generator!.binaryTargets, this.platform!),
    }

    return printGeneratorConfig(fixedGenerator)
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
