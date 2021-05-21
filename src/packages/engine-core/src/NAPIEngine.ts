import Debug from '@prisma/debug'
import { getEnginesPath } from '@prisma/engines'
import {
  getNapiName,
  getPlatform,
  Platform,
  platforms,
} from '@prisma/get-platform'
import chalk from 'chalk'
import EventEmitter from 'events'
import fs from 'fs'
import path from 'path'
import type {
  DatasourceOverwrite,
  Engine,
  EngineConfig,
  EngineEventType,
} from './Engine'
import {
  getErrorMessageWithLink,
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
  RequestError,
} from './errors'
import {
  ConfigMetaFormat,
  NAPI,
  QueryEngine,
  QueryEngineConstructor,
  QueryEngineEvent,
  QueryEngineLogLevel,
  QueryEnginePanicEvent,
  QueryEngineQueryEvent,
  RustRequestError,
  SyncRustError,
} from './napi-types'
import { printGeneratorConfig } from './printGeneratorConfig'
import { fixBinaryTargets } from './util'

const debug = Debug('prisma:client:napi')

const MAX_REQUEST_RETRIES = process.env.PRISMA_CLIENT_NO_RETRY ? 1 : 2

function isQueryEvent(event: QueryEngineEvent): event is QueryEngineQueryEvent {
  return event['item_type'] === 'query' && 'query' in event
}
function isPanicEvent(event: QueryEngineEvent): event is QueryEnginePanicEvent {
  return event.level === 'error' && event['message'] === 'PANIC'
}

const knownPlatforms: Platform[] = [...platforms, 'native']
export class NAPIEngine implements Engine {
  private engine?: QueryEngine
  private setupPromise?: Promise<void>
  private connectPromise?: Promise<void>
  private disconnectPromise?: Promise<void>
  private currentQuery?: Promise<any>
  private config: EngineConfig
  private QueryEngine?: QueryEngineConstructor
  private library?: NAPI
  private logEmitter: EventEmitter
  libQueryEnginePath?: string
  platform?: Platform
  datasourceOverrides: Record<string, string>
  datamodel: string
  logQueries: boolean
  logLevel: QueryEngineLogLevel
  lastQuery?: string
  lastError?: any

  connected: boolean
  beforeExitListener?: (args?: any) => any
  versionInfo?: {
    commit: string
    version: string
  }

  constructor(config: EngineConfig) {
    this.datamodel = fs.readFileSync(config.datamodelPath, 'utf-8')
    this.config = config
    this.connected = false
    this.logQueries = config.logQueries ?? false
    this.logLevel = config.logLevel ?? 'error'
    this.logEmitter = new EventEmitter()
    this.logEmitter.on('error', (e) => {
      // to prevent unhandled error events
    })
    this.datasourceOverrides = config.datasources
      ? this.convertDatasources(config.datasources)
      : {}
    if (config.enableEngineDebugMode) {
      this.logLevel = 'debug'
      // Debug.enable('*')
    }
    this.setupPromise = this.internalSetup()
  }
  private async internalSetup(): Promise<void> {
    debug('internalSetup')
    if (this.setupPromise) return this.setupPromise
    this.platform = await this.getPlatform()
    this.libQueryEnginePath = await this.getLibQueryEnginePath()
    await this.loadEngine()
    this.version()
  }
  private async getPlatform() {
    if (this.platform) return this.platform
    const platform = await getPlatform()
    if (!knownPlatforms.includes(platform)) {
      throw new PrismaClientInitializationError(
        `Unknown ${chalk.red(
          'PRISMA_QUERY_ENGINE_LIBRARY',
        )} ${chalk.redBright.bold(
          this.platform,
        )}. Possible binaryTargets: ${chalk.greenBright(
          knownPlatforms.join(', '),
        )} or a path to the query engine library.
You may have to run ${chalk.greenBright(
          'prisma generate',
        )} for your changes to take effect.`,
        this.config.clientVersion!,
      )
    }
    return platform
  }
  private parseEngineResponse<T>(response?: string): T {
    if (!response) {
      throw new PrismaClientUnknownRequestError(
        `Response from the Engine was empty`,
        this.config.clientVersion!,
      )
    }
    try {
      const config = JSON.parse(response)
      return config as T
    } catch (err) {
      throw new PrismaClientUnknownRequestError(
        `Unable to JSON.parse response from engine`,
        this.config.clientVersion!,
      )
    }
  }
  private convertDatasources(
    datasources: DatasourceOverwrite[],
  ): Record<string, string> {
    const obj = Object.create(null)
    for (const { name, url } of datasources) {
      obj[name] = url
    }
    return obj
  }
  private async loadEngine(): Promise<void> {
    debug('loadEngine')
    if (!this.engine) {
      if (!this.QueryEngine) {
        if (!this.libQueryEnginePath) {
          this.libQueryEnginePath = await this.getLibQueryEnginePath()
          debug(`using ${this.libQueryEnginePath}`)
        }
        try {
          // this require needs to be resolved at runtime, tell webpack to ignore it
          this.library = eval('require')(this.libQueryEnginePath) as NAPI
          this.QueryEngine = this.library.QueryEngine
        } catch (e) {
          if (fs.existsSync(this.libQueryEnginePath)) {
            throw new PrismaClientInitializationError(
              `Unable to load NAPI Library from ${chalk.dim(
                this.libQueryEnginePath,
              )}, Library may be corrupt`,
              this.config.clientVersion!,
            )
          } else {
            throw new PrismaClientInitializationError(
              `Unable to load NAPI Library from ${chalk.dim(
                this.libQueryEnginePath,
              )}, It does not exist`,
              this.config.clientVersion!,
            )
          }
        }
      }
      if (this.QueryEngine) {
        try {
          this.engine = new this.QueryEngine(
            {
              datamodel: this.datamodel,
              logQueries: this.config.logQueries ?? false,
              ignoreEnvVarErrors: false,
              datasourceOverrides: this.datasourceOverrides,
              logLevel: this.logLevel,
              configDir: this.config.cwd!,
            },
            (err, log) => this.logger(err, log),
          )
        } catch (e) {
          const error = this.parseInitError(e.message)
          if (typeof error === 'string') {
            throw e
          } else {
            throw new PrismaClientInitializationError(
              error.message,
              this.config.clientVersion!,
              error.error_code,
            )
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
        timestamp: Date.now(),
        query: event.query,
        params: event.params,
        duration: event.duration_ms,
        target: event.module_path,
      })
    } else if (isPanicEvent(event)) {
      this.lastError = new PrismaClientRustPanicError(
        this.getErrorMessageWithLink(
          `${event.message}: ${event.reason} in ${event.file}:${event.line}:${event.column}`,
        ),
        this.config.clientVersion!,
      )
      this.logEmitter.emit('error', this.lastError)
    } else {
      this.logEmitter.emit(event.level, event)
    }
  }
  private getErrorMessageWithLink(title: string) {
    return getErrorMessageWithLink({
      platform: this.platform,
      title,
      version: this.config.clientVersion!,
      engineVersion: this.versionInfo?.version,
      // TODO
      database: this.config.activeProvider as any,
      query: this.lastQuery!,
    })
  }
  private parseInitError(str: string): SyncRustError | string {
    try {
      const error = JSON.parse(str)
      if (typeof error.is_panic !== 'undefined') {
        return error
      }
    } catch (e) {
      //
    }
    return str
  }
  private parseRequestError(str: string): RustRequestError | string {
    try {
      const error = JSON.parse(str)
      if (typeof error.is_panic !== 'undefined') {
        return error
      }
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
  async emitExit() {
    await this.currentQuery
    debug('emitExit')
    if (this.beforeExitListener) {
      try {
        await this.beforeExitListener()
      } catch (e) {
        console.error(e)
      }
    }
  }
  async start(): Promise<void> {
    await this.setupPromise
    await this.disconnectPromise
    if (this.connectPromise) {
      debug(`already starting: ${this.connected}`)
      await this.connectPromise
      if (this.connected) {
        return
      }
    }
    if (!this.connected) {
      // eslint-disable-next-line no-async-promise-executor
      this.connectPromise = new Promise(async (res) => {
        debug('starting')
        await this.engine?.connect({ enableRawQueries: true })
        this.connected = true
        debug('started')
        res()
      })
      return this.connectPromise
    }
  }

  async stop(): Promise<void> {
    await this.connectPromise
    await this.currentQuery
    debug(`stop state ${this.connected}`)
    if (this.disconnectPromise) {
      debug('engine is already disconnecting')
      await this.disconnectPromise
      if (!this.connected) {
        this.disconnectPromise = undefined
        return
      }
    }
    if (this.connected) {
      // eslint-disable-next-line no-async-promise-executor
      this.disconnectPromise = new Promise(async (res) => {
        await this.emitExit()
        debug('disconnect called')
        await this.engine?.disconnect()
        this.connected = false
        debug('disconnect resolved')

        res()
      })
    }
    return this.disconnectPromise
  }
  kill(signal: string): void {
    if (this.connected && !this.disconnectPromise) {
      // eslint-disable-next-line no-async-promise-executor
      this.disconnectPromise = new Promise(async (res) => {
        await this.emitExit()
        debug(`disconnect called with kill signal ${signal}`)
        await this.engine?.disconnect()
        this.connected = false
        debug(`disconnect resolved`)
        res()
      })
    }
  }
  async getConfig(): Promise<ConfigMetaFormat> {
    return this.library!.getConfig({
      datamodel: this.datamodel,
      datasourceOverrides: this.datasourceOverrides,
      ignoreEnvVarErrors: true,
    })
  }
  version(forceRun?: boolean): string {
    this.versionInfo = this.library?.version()
    return this.versionInfo?.version ?? 'unknown'
  }
  private graphQLToJSError(
    error: RequestError,
  ): PrismaClientKnownRequestError | PrismaClientUnknownRequestError {
    debug('graphQLToJSError')
    if (error.user_facing_error.error_code) {
      return new PrismaClientKnownRequestError(
        error.user_facing_error.message,
        error.user_facing_error.error_code,
        this.config.clientVersion!,
        error.user_facing_error.meta,
      )
    }
    return new PrismaClientUnknownRequestError(
      error.error,
      this.config.clientVersion!,
    )
  }
  async request<T>(
    query: string,
    headers: Record<string, string>,
    numTry: number,
  ): Promise<{ data: T; elapsed: number }> {
    try {
      await this.start()
      debug(`request state: ${this.connected}`)
      const request = { query, variables: {} }
      this.lastQuery = JSON.stringify(request)
      this.currentQuery = this.engine!.query(request, {})
      const data = this.parseEngineResponse<any>(await this.currentQuery)
      if (data.errors) {
        if (data.errors.length === 1) {
          throw this.graphQLToJSError(data.errors[0])
        }
        // this case should not happen, as the query engine only returns one error
        throw new PrismaClientUnknownRequestError(
          JSON.stringify(data.errors),
          this.config.clientVersion!,
        )
      } else if (this.lastError) {
        throw this.lastError
      }
      return { data, elapsed: 0 }
    } catch (e) {
      const error = this.parseRequestError(e.message)
      if (typeof error === 'string') {
        throw e
      } else {
        throw new PrismaClientUnknownRequestError(
          `${error.message}\n${error.backtrace}`,
          this.config.clientVersion!,
        )
      }
    }
  }
  async requestBatch(
    queries: string[],
    transaction = false,
    numTry = 1,
  ): Promise<any> {
    await this.start()
    debug('requestBatch')
    const variables = {}
    const request = {
      batch: queries.map((query) => ({ query, variables })),
      transaction,
    }
    this.lastQuery = JSON.stringify(request)
    this.currentQuery = this.engine!.query(request, {})
    const result = await this.currentQuery
    const data = this.parseEngineResponse<any>(result)

    if (data.errors) {
      if (data.errors.length === 1) {
        throw this.graphQLToJSError(data.errors[0])
      }
      // this case should not happen, as the query engine only returns one error
      throw new PrismaClientUnknownRequestError(
        JSON.stringify(data.errors),
        this.config.clientVersion!,
      )
    }
    try {
      const { batchResult, errors } = data
      if (Array.isArray(batchResult)) {
        return batchResult.map((result) => {
          if (result.errors) {
            return this.lastError ?? this.graphQLToJSError(result.errors[0])
          }
          return {
            data: result,
            elapsed: 0,
          }
        })
      } else {
        if (errors && errors.length === 1) {
          throw new Error(errors[0].error)
        }
        throw new Error(JSON.stringify(data))
      }
    } catch (e) {
      // retry
      if (numTry <= MAX_REQUEST_RETRIES) {
        return this.requestBatch(queries, transaction, numTry + 1)
      }

      throw e
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

    if (__filename.includes('NAPIEngine')) {
      enginePath = path.join(getEnginesPath(), getNapiName(this.platform, 'fs'))
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
      debug(`Search for Query Engine Library in ${location}`)
      enginePath = path.join(location, getNapiName(this.platform, 'fs'))
      if (fs.existsSync(enginePath)) {
        return { enginePath, searchedLocations }
      }
    }
    enginePath = path.join(__dirname, getNapiName(this.platform, 'fs'))

    return { enginePath: enginePath ?? '', searchedLocations }
  }
  private async getLibQueryEnginePath(): Promise<string> {
    const libPath =
      process.env.PRISMA_QUERY_ENGINE_LIBRARY ?? this.config.prismaPath
    if (libPath && fs.existsSync(libPath)) {
      return libPath
    }
    this.platform = this.platform ?? (await getPlatform())
    const { enginePath, searchedLocations } = await this.resolveEnginePath()
    // If path to query engine doesn't exist, throw
    if (!fs.existsSync(enginePath)) {
      const pinnedStr = this.platform
        ? `\nYou incorrectly pinned it to ${chalk.redBright.bold(
            `${this.platform}`,
          )}\n`
        : ''

      let errorText = `Query engine library for current platform "${chalk.bold(
        this.platform,
      )}" could not be found.${pinnedStr}
This probably happens, because you built Prisma Client on a different platform.
(Prisma Client looked in "${chalk.underline(enginePath)}")

Searched Locations:

${searchedLocations
  .map((f) => {
    let msg = `  ${f}`
    if (
      process.env.DEBUG === 'node-engine-search-locations' &&
      fs.existsSync(f)
    ) {
      const dir = fs.readdirSync(f)
      msg += dir.map((d) => `    ${d}`).join('\n')
    }
    return msg
  })
  .join(
    '\n' + (process.env.DEBUG === 'node-engine-search-locations' ? '\n' : ''),
  )}\n`
      // The generator should always be there during normal usage
      if (this.config.generator) {
        // The user already added it, but it still doesn't work 🤷‍♀️
        // That means, that some build system just deleted the files 🤔
        this.platform = this.platform ?? (await getPlatform())
        if (
          this.config.generator.binaryTargets.includes(this.platform) ||
          this.config.generator.binaryTargets.includes('native')
        ) {
          errorText += `
You already added the platform${
            this.config.generator.binaryTargets.length > 1 ? 's' : ''
          } ${this.config.generator.binaryTargets
            .map((t) => `"${chalk.bold(t)}"`)
            .join(', ')} to the "${chalk.underline('generator')}" block
in the "schema.prisma" file as described in https://pris.ly/d/client-generator,
but something went wrong. That's suboptimal.

Please create an issue at https://github.com/prisma/prisma/issues/new`
          errorText += ``
        } else {
          // If they didn't even have the current running platform in the schema.prisma file, it's easy
          // Just add it
          errorText += `\n\nTo solve this problem, add the platform "${
            this.platform
          }" to the "${chalk.underline(
            'binaryTargets',
          )}" attribute in the "${chalk.underline(
            'generator',
          )}" block in the "schema.prisma" file:
${chalk.greenBright(this.getFixedGenerator())}

Then run "${chalk.greenBright(
            'prisma generate',
          )}" for your changes to take effect.
Read more about deploying Prisma Client: https://pris.ly/d/client-generator`
        }
      } else {
        errorText += `\n\nRead more about deploying Prisma Client: https://pris.ly/d/client-generator\n`
      }

      throw new PrismaClientInitializationError(
        errorText,
        this.config.clientVersion!,
      )
    }
    this.platform = this.platform ?? (await getPlatform())
    return enginePath
  }
  private getFixedGenerator(): string {
    const fixedGenerator = {
      ...this.config.generator!,
      binaryTargets: fixBinaryTargets(
        this.config.generator!.binaryTargets as Platform[],
        this.platform!,
      ),
    }

    return printGeneratorConfig(fixedGenerator)
  }
}
