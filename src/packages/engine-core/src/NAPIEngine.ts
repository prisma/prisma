import Debug from '@prisma/debug'
import { getEnginesPath } from '@prisma/engines'
import { DMMF } from '@prisma/generator-helper'
import { getNapiName, getPlatform, Platform } from '@prisma/get-platform'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
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
const debug = Debug('prisma:engine')
const exists = promisify(fs.exists)

type QueryEngineConfig = {
  datamodel: string
  datasourceOverrides?: Record<string, string>
}

export interface QueryEngineConstructor {
  new (config: QueryEngineConfig): QueryEngine
}

type ConnectArgs = {
  enableRawQueries: boolean
}

export type QueryEngine = {
  connect(connectArgs: ConnectArgs): Promise<void>
  disconnect(): void
  getConfig(): Promise<GetConfigResult>
  dmmf(): Promise<DMMF.Document>
  query(request: any): Promise<string>
  sdlSchema(): Promise<string>
  serverInfo(): Promise<string> // ServerInfo
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

export class NAPIEngine implements Engine {
  private engine?: QueryEngine
  private startPromise?: Promise<void>
  private loadEnginePromise?: Promise<void>

  private config: EngineConfig
  private QueryEngine?: QueryEngineConstructor
  platformPromise?: Promise<Platform>
  libQueryEnginePath: any
  incorrectlyPinnedBinaryTarget: any
  dirname: any
  clientVersion: any
  platform?: Platform
  datasourceOverrides: Record<string, string>
  datamodel: string
  constructor(config: EngineConfig) {
    this.datamodel = fs.readFileSync(config.datamodelPath, 'utf-8')
    this.config = config
    this.libQueryEnginePath =
      process.env.LIB_QUERY_ENGINE_PATH ?? config.prismaPath
    ;(this.datasourceOverrides = config.datasources
      ? this.convertDatasources(config.datasources)
      : {}),
      (this.loadEnginePromise = this.loadEngine())
    this.platformPromise = getPlatform()
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
  private async loadEngine() {
    if (this.loadEnginePromise) return this.loadEnginePromise
    if (!this.engine) {
      if (!this.QueryEngine) {
        if (!this.libQueryEnginePath) {
          this.libQueryEnginePath = await this.getLibQueryEnginePath()
          debug({ libQueryEnginePath: this.libQueryEnginePath })
        }
        try {
          this.QueryEngine = require(this.libQueryEnginePath).QueryEngine
        } catch (e) {
          // How should we handle this
          throw new Error(e)
        }
      }
      if (this.QueryEngine) {
        try {
          this.engine = new this.QueryEngine({
            datamodel: this.datamodel,
            datasourceOverrides: this.datasourceOverrides,
          })
          debug('napi engine instantiated')
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

  on(event: EngineEventType, listener: (args?: any) => any): void {}
  async start(): Promise<void> {
    await this.loadEngine()
    if (this.startPromise) {
      return this.startPromise
    }

    this.startPromise = this.engine?.connect({ enableRawQueries: true })
    return this.startPromise
  }
  async stop(): Promise<void> {
    return new Promise((res) => {
      this.engine?.disconnect()
      res()
    })
  }
  kill(signal: string): void {
    return this.engine?.disconnect()
  }
  async getConfig(): Promise<GetConfigResult> {
    await this.loadEngine()
    return this.engine!.getConfig()
  }
  async version(forceRun?: boolean): Promise<string> {
    await this.loadEngine()
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
    await this.start()
    try {
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
  async requestBatch<T>(
    queries: string[],
    transaction?: boolean,
    numTry?: number,
  ): Promise<any> {
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
    return data
  }
  private async getPlatform(): Promise<Platform> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (this.platformPromise) {
      return this.platformPromise
    }

    this.platformPromise = getPlatform()

    return this.platformPromise
  }
  private getQueryEnginePath(
    platform: Platform,
    prefix: string = __dirname,
  ): string {
    const queryEnginePath = path.join(prefix, getNapiName(platform, 'fs'))
    return queryEnginePath
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

    this.platform =
      this.platform ?? (await this.platformPromise) ?? (await getPlatform())

    if (__filename.includes('NAPIEngine')) {
      enginePath = this.getQueryEnginePath(this.platform, getEnginesPath())
      return { enginePath, searchedLocations }
    }
    const searchLocations: string[] = [
      eval(`require('path').join(__dirname, '../../../.prisma/client')`), // Dot Prisma Path
      this.config.generator?.output ?? eval('__dirname'), // Custom Generator Path
      path.join(eval('__dirname'), '..'), // parentDirName
      path.dirname(this.config.datamodelPath), // Datamodel Dir
      this.config.cwd, //cwdPath
    ]

    if (this.dirname) {
      searchLocations.push(this.dirname)
    }

    for (const location of searchLocations) {
      searchedLocations.push(location)
      debug(`Search for Query Engine in ${location}`)
      enginePath = this.getQueryEnginePath(this.platform, location)
      if (fs.existsSync(enginePath)) {
        return { enginePath, searchedLocations }
      }
    }
    enginePath = this.getQueryEnginePath(this.platform)

    return { enginePath: enginePath ?? '', searchedLocations }
  }
  private async getLibQueryEnginePath(): Promise<string> {
    const { enginePath, searchedLocations } = await this.resolveEnginePath()
    await this.platformPromise
    // If path to query engine doesn't exist, throw
    if (!(await exists(enginePath))) {
      const pinnedStr = this.incorrectlyPinnedBinaryTarget
        ? `\nYou incorrectly pinned it to ${chalk.redBright.bold(
            `${this.incorrectlyPinnedBinaryTarget}`,
          )}\n`
        : ''

      let errorText = `Query engine binary for current platform "${chalk.bold(
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
        await this.platformPromise
        if (
          this.config.generator.binaryTargets.includes(this.platform!) ||
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

Please create an issue at https://github.com/prisma/prisma-client-js/issues/new`
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

      throw new PrismaClientInitializationError(errorText, this.clientVersion!)
    }
    // TODO Implement incorrectlyPinnedBinaryTarget
    if (this.incorrectlyPinnedBinaryTarget) {
      console.error(`${chalk.yellow(
        'Warning:',
      )} You pinned the platform ${chalk.bold(
        this.incorrectlyPinnedBinaryTarget,
      )}, but Prisma Client detects ${chalk.bold(await this.getPlatform())}.
This means you should very likely pin the platform ${chalk.greenBright(
        await this.getPlatform(),
      )} instead.
${chalk.dim("In case we're mistaken, please report this to us 🙏.")}`)
    }
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
