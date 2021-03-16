import Debug from '@prisma/debug'
import { ensureBinariesExist, getEnginesPath } from '@prisma/engines'
import { DMMF } from '@prisma/generator-helper'
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
  GetConfigResult,
} from './Engine'
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  RequestError,
} from './errors'
import { printGeneratorConfig } from './printGeneratorConfig'
import { fixBinaryTargets } from './util'
const debug = Debug('prisma:client:napi')

const MAX_REQUEST_RETRIES = process.env.PRISMA_CLIENT_NO_RETRY ? 1 : 2
type QueryEngineLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'off'
type QueryEngineEvent = QueryEngineLogEvent | QueryEngineQueryEvent
type QueryEngineConfig = {
  datamodel: string
  datasourceOverrides?: Record<string, string>
  logLevel: QueryEngineLogLevel
}
type QueryEngineLogEvent = {
  level: string
  module_path: string
  message: string
}
type QueryEngineQueryEvent = {
  level: 'info'
  module_path: string
  query: string
  item_type: 'query'
  params: string
  duration_ms: string
  result: string
}

export interface QueryEngineConstructor {
  new (
    config: QueryEngineConfig,
    logger: (err: string, log: string) => void,
  ): QueryEngine
}

type ConnectArgs = {
  enableRawQueries: boolean
}

export type QueryEngine = {
  connect(connectArgs: ConnectArgs): Promise<void>
  disconnect(): Promise<void>
  getConfig(): Promise<GetConfigResult>
  dmmf(): Promise<DMMF.Document>
  query(request: any): Promise<string>
  sdlSchema(): Promise<string>
  serverInfo(): Promise<string>
  nextLogEvent(): Promise<string>
}

type ServerInfo = {
  commit: string
  version: string
  primaryConnector: string
}

type SyncRustError = {
  is_panic: boolean
  message: string
  meta: {
    full_error: string
  }
  error_code: string
}

type RustRequestError = {
  is_panic: boolean
  message: string
  backtrace: string
}
function isQueryEvent(event: QueryEngineEvent): event is QueryEngineQueryEvent {
  return event.level === 'info' && event['item_type'] === 'query'
}

const knownPlatforms: Platform[] = [...platforms, 'native']
export class NAPIEngine implements Engine {
  private engine?: QueryEngine
  private setupPromise?: Promise<void>
  private connectPromise?: Promise<void>
  private config: EngineConfig
  private QueryEngine?: QueryEngineConstructor
  private logEmitter: EventEmitter
  libQueryEnginePath?: string
  platform?: Platform
  datasourceOverrides: Record<string, string>
  datamodel: string
  logQueries: boolean
  logLevel: QueryEngineLogLevel

  connected: boolean
  beforeExitListener?: (args?: any) => any

  constructor(config: EngineConfig) {
    this.datamodel = fs.readFileSync(config.datamodelPath, 'utf-8')
    this.config = config
    this.connected = false
    this.logQueries = config.logQueries ?? false
    this.logLevel = config.logLevel ?? 'error'
    this.logEmitter = new EventEmitter()
    this.datasourceOverrides = this.config.datasources
      ? this.convertDatasources(this.config.datasources)
      : {}

    if (this.logQueries) {
      process.env.LOG_QUERIES = 'true'
      this.logLevel = 'info'
    }
    if (config.enableEngineDebugMode) {
      Debug.enable('*')
    }
    this.setupPromise = this.internalSetup()
  }
  private async internalSetup(): Promise<void> {
    this.platform = await this.getPlatform()
    await ensureBinariesExist()
    this.libQueryEnginePath = await this.getLibQueryEnginePath()
    return this.loadEngine()
  }
  private async getPlatform() {
    if (this.platform) return this.platform
    const platform = await getPlatform()
    if (!knownPlatforms.includes(platform)) {
      throw new PrismaClientInitializationError(
        `Unknown ${chalk.red(
          'PRISMA_QUERY_ENGINE_BINARY',
        )} ${chalk.redBright.bold(
          this.platform,
        )}. Possible binaryTargets: ${chalk.greenBright(
          knownPlatforms.join(', '),
        )} or a path to the query engine binary.
You may have to run ${chalk.greenBright(
          'prisma generate',
        )} for your changes to take effect.`,
        this.config.clientVersion!,
      )
    }
    return platform
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
    if (!this.engine) {
      if (!this.QueryEngine) {
        if (!this.libQueryEnginePath) {
          this.libQueryEnginePath = await this.getLibQueryEnginePath()
          debug(`using ${this.libQueryEnginePath}`)
        }
        try {
          this.QueryEngine = require(this.libQueryEnginePath).QueryEngine
        } catch (e) {
          throw new PrismaClientInitializationError(
            `Unable to load NAPI Library from ${chalk.dim(
              this.libQueryEnginePath,
            )}`,
            this.config.clientVersion!,
          )
        }
      }
      if (this.QueryEngine) {
        try {
          this.engine = new this.QueryEngine(
            {
              datamodel: this.datamodel,
              datasourceOverrides: this.datasourceOverrides,
              logLevel: this.logLevel,
            },
            (err, log) => {
              if (err) throw new Error(err)
              let event: QueryEngineEvent | null = null
              try {
                event = JSON.parse(log)
                if (!event) return
              } catch (e) {
                throw new Error(e)
              }
              event.level = event?.level.toLowerCase() ?? 'unknown'
              if (isQueryEvent(event)) {
                this.logEmitter.emit('query', {
                  timestamp: Date.now(),
                  query: event.query,
                  params: event.params,
                  duration: event.duration_ms,
                  target: event.module_path,
                })
              } else {
                this.logEmitter.emit(event.level, event)
              }
            },
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
    if (this.connectPromise || this.connected) {
      return this.connectPromise
    }
    this.connected = true
    return this.engine?.connect({ enableRawQueries: true })
  }
  async stop(): Promise<void> {
    await this.emitExit()
    await this.engine?.disconnect()
  }
  kill(signal: string): void {
    debug(`disconnect called with kill signal ${signal}`)
    void this.emitExit().then(() => {
      void this.engine?.disconnect()
    })
  }
  async getConfig(): Promise<GetConfigResult> {
    await this.start()
    return this.engine!.getConfig()
  }
  async version(forceRun?: boolean): Promise<string> {
    await this.start()
    const serverInfo: ServerInfo = JSON.parse(await this.engine!.serverInfo())
    return serverInfo.version
  }
  private graphQLToJSError(
    error: RequestError,
  ): PrismaClientKnownRequestError | PrismaClientUnknownRequestError {
    if (error.user_facing_error.error_code) {
      return new PrismaClientKnownRequestError(
        error.user_facing_error.message,
        error.user_facing_error.error_code,
        this.config.clientVersion!,
        error.user_facing_error.meta,
      )
    }

    return new PrismaClientUnknownRequestError(
      error.user_facing_error.message,
      this.config.clientVersion!,
    )
  }
  async request<T>(
    query: string,
    headers: Record<string, string>,
    numTry: number,
  ): Promise<T> {
    try {
      await this.start()
      const data = JSON.parse(
        await this.engine!.query({ query, variables: {} }),
      )
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
      return data
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
    const variables = {}
    const body = {
      batch: queries.map((query) => ({ query, variables })),
      transaction,
    }
    const result = await this.engine!.query(body)
    const data = JSON.parse(result)

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
            return this.graphQLToJSError(result.errors[0])
          }
          return {
            data: result,
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
      this.config.generator?.output ?? eval('__dirname'), // Custom Generator Path
      path.join(eval('__dirname'), '..'), // parentDirName
      path.dirname(this.config.datamodelPath), // Datamodel Dir
      this.config.cwd, //cwdPath
    ]

    if (this.config.dirname) {
      searchLocations.push(this.config.dirname)
    }

    for (const location of searchLocations) {
      searchedLocations.push(location)
      debug(`Search for Query Engine in ${location}`)
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
