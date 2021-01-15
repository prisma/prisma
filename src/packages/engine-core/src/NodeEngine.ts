import { getEnginesPath } from '@prisma/engines'
import {
  ConnectorType,
  DataSource,
  GeneratorConfig,
} from '@prisma/generator-helper'
import { getPlatform, Platform } from '@prisma/get-platform'
import chalk from 'chalk'
import { ChildProcessByStdio, spawn } from 'child_process'
import { Readable } from 'stream'
import Debug from '@prisma/debug'
import EventEmitter from 'events'
import execa from 'execa'
import fs from 'fs'
import net from 'net'
import pRetry from 'p-retry'
import { URL } from 'url'
import path from 'path'
import { promisify } from 'util'
import byline from './byline'
import {
  getErrorMessageWithLink,
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
  RequestError,
} from './Engine'
import {
  convertLog,
  isRustError,
  RustError,
  RustLog,
  getMessage,
  isRustErrorLog,
} from './log'
import { omit } from './omit'
import { printGeneratorConfig } from './printGeneratorConfig'
import { Undici } from './undici'
import { fixBinaryTargets, getRandomString, plusX } from './util'

const debug = Debug('engine')
const exists = promisify(fs.exists)

export interface DatasourceOverwrite {
  name: string
  url: string
}

// eslint-disable-next-line
const logger = (...args) => {
  // console.log(chalk.red.bold('logger '), ...args)
}

export interface EngineConfig {
  cwd?: string
  dirname?: string
  datamodelPath: string
  enableDebugLogs?: boolean
  enableEngineDebugMode?: boolean // dangerous! https://github.com/prisma/prisma-engines/issues/764
  prismaPath?: string
  fetcher?: (query: string) => Promise<{ data?: any; error?: any }>
  generator?: GeneratorConfig
  datasources?: DatasourceOverwrite[]
  showColors?: boolean
  logQueries?: boolean
  logLevel?: 'info' | 'warn'
  env?: Record<string, string>
  flags?: string[]
  useUds?: boolean

  clientVersion?: string
  enableExperimental?: string[]
  engineEndpoint?: string
  activeProvider?: string
}

type GetConfigResult = {
  datasources: DataSource[]
  generators: GeneratorConfig[]
}

/**
 * Node.js based wrapper to run the Prisma binary
 */

const knownPlatforms: Platform[] = [
  'native',
  'darwin',
  'debian-openssl-1.0.x',
  'debian-openssl-1.1.x',
  'linux-arm-openssl-1.0.x',
  'linux-arm-openssl-1.1.x',
  'rhel-openssl-1.0.x',
  'rhel-openssl-1.1.x',
  'linux-musl',
  'linux-nixos',
  'windows',
  'freebsd11',
  'freebsd12',
  'openbsd',
  'netbsd',
  'arm',
]

export type Deferred = {
  resolve: () => void
  reject: (err: Error) => void
}

export type StopDeferred = {
  resolve: (code: number | null) => void
  reject: (err: Error) => void
}
export type EngineEventType = 'query' | 'info' | 'warn' | 'error' | 'beforeExit'

const engines: NodeEngine[] = []
const socketPaths: string[] = []

const MAX_STARTS = process.env.PRISMA_CLIENT_NO_RETRY ? 1 : 2
const MAX_REQUEST_RETRIES = process.env.PRISMA_CLIENT_NO_RETRY ? 1 : 2

export class NodeEngine {
  private logEmitter: EventEmitter
  private showColors: boolean
  private logQueries: boolean
  private logLevel?: 'info' | 'warn'
  private env?: Record<string, string>
  private flags: string[]
  private port?: number
  private enableDebugLogs: boolean
  private enableEngineDebugMode: boolean
  private child?: ChildProcessByStdio<null, Readable, Readable>
  private clientVersion?: string
  private lastPanic?: Error
  private globalKillSignalReceived?: string
  private startCount = 0
  private enableExperimental: string[] = []
  private engineEndpoint?: string
  private lastErrorLog?: RustLog
  private lastRustError?: RustError
  private useUds = false
  private socketPath?: string
  private getConfigPromise?: Promise<GetConfigResult>
  private stopPromise?: Promise<void>
  private beforeExitListener?: () => Promise<void>
  private dirname?: string
  private cwd: string
  private datamodelPath: string
  private prismaPath?: string
  private stderrLogs = ''
  private currentRequestPromise?: any
  private platformPromise?: Promise<Platform>
  private platform?: Platform | string
  private generator?: GeneratorConfig
  private incorrectlyPinnedBinaryTarget?: string
  private datasources?: DatasourceOverwrite[]
  private startPromise?: Promise<any>
  private versionPromise?: Promise<string>
  private engineStartDeferred?: Deferred
  private engineStopDeferred?: StopDeferred
  private undici?: Undici
  private lastQuery?: string
  private lastVersion?: string
  private lastActiveProvider?: ConnectorType
  private activeProvider?: string
  /**
   * exiting is used to tell the .on('exit') hook, if the exit came from our script.
   * As soon as the Prisma binary returns a correct return code (like 1 or 0), we don't need this anymore
   */
  constructor({
    cwd,
    datamodelPath,
    prismaPath,
    generator,
    datasources,
    showColors,
    logLevel,
    logQueries,
    env,
    flags,
    clientVersion,
    enableExperimental,
    engineEndpoint,
    enableDebugLogs,
    enableEngineDebugMode,
    dirname,
    useUds,
    activeProvider,
  }: EngineConfig) {
    this.dirname = dirname
    this.useUds = useUds === undefined ? process.platform !== 'win32' : useUds
    this.env = env
    this.cwd = this.resolveCwd(cwd)
    this.enableDebugLogs = enableDebugLogs ?? false
    this.enableEngineDebugMode = enableEngineDebugMode ?? false
    this.datamodelPath = datamodelPath
    this.prismaPath = process.env.PRISMA_QUERY_ENGINE_BINARY ?? prismaPath
    this.generator = generator
    this.datasources = datasources
    this.logEmitter = new EventEmitter()
    this.logEmitter.on('error', () => {
      // to prevent unhandled error events
    })
    this.showColors = showColors ?? false
    this.logLevel = logLevel
    this.logQueries = logQueries ?? false
    this.clientVersion = clientVersion
    this.flags = flags ?? []
    this.enableExperimental = enableExperimental ?? []
    this.activeProvider = activeProvider
    const removedFlags = [
      'middlewares',
      'aggregateApi',
      'distinct',
      'aggregations',
      'insensitiveFilters',
      'atomicNumberOperations',
      'transactionApi',
      'transaction',
      'connectOrCreate',
    ]
    const filteredFlags = ['nativeTypes']
    const removedFlagsUsed = this.enableExperimental.filter((e) =>
      removedFlags.includes(e),
    )
    if (
      removedFlagsUsed.length > 0 &&
      !process.env.PRISMA_HIDE_PREVIEW_FLAG_WARNINGS
    ) {
      console.log(
        `${chalk.blueBright(
          'info',
        )} The preview flags \`${removedFlagsUsed.join(
          '`, `',
        )}\` were removed, you can now safely remove them from your schema.prisma.`,
      )
    }
    this.enableExperimental = this.enableExperimental.filter(
      (e) => !removedFlags.includes(e) && !filteredFlags.includes(e),
    )
    this.engineEndpoint = engineEndpoint

    if (engineEndpoint) {
      const url = new URL(engineEndpoint)
      this.port = Number(url.port)
    }

    if (this.platform) {
      if (
        !knownPlatforms.includes(this.platform as Platform) &&
        !fs.existsSync(this.platform)
      ) {
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
          this.clientVersion!,
        )
      }
    } else {
      void this.getPlatform()
    }
    if (this.enableDebugLogs) {
      Debug.enable('*')
    }
    engines.push(this)
    this.checkForTooManyEngines()
  }

  private setError(err: Error | RustLog | RustError) {
    if (isRustError(err)) {
      this.lastRustError = err
      this.logEmitter.emit(
        'error',
        new PrismaClientRustError({
          clientVersion: this.clientVersion!,
          error: err,
        }),
      )
      if (err.is_panic) {
        this.handlePanic()
      }
    } else if (isRustErrorLog(err)) {
      this.lastErrorLog = err
      this.logEmitter.emit(
        'error',
        new PrismaClientRustError({
          clientVersion: this.clientVersion!,
          log: err,
        }),
      )
      if (err.fields?.message === 'PANIC') {
        this.handlePanic()
      }
    } else {
      this.logEmitter.emit('error', err)
    }
  }

  private checkForTooManyEngines() {
    if (engines.length >= 10) {
      const runningEngines = engines.filter((e) => e.child)
      if (runningEngines.length === 10) {
        console.warn(
          `${chalk.yellow(
            'warn(prisma-client)',
          )} Already 10 Prisma Clients are actively running.`,
        )
      }
    }
  }

  private resolveCwd(cwd?: string): string {
    if (cwd && fs.existsSync(cwd) && fs.lstatSync(cwd).isDirectory()) {
      return cwd
    }

    return process.cwd()
  }

  on(
    event: EngineEventType,
    listener: (args?: any) => any,
  ): void {
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

  async getPlatform(): Promise<Platform> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (this.platformPromise) {
      return this.platformPromise
    }

    this.platformPromise = getPlatform()

    return this.platformPromise
  }

  private getQueryEnginePath(
    platform: string,
    prefix: string = __dirname,
  ): string {
    let queryEnginePath = path.join(prefix, `query-engine-${platform}`)

    if (platform === 'windows') {
      queryEnginePath = `${queryEnginePath}.exe`
    }

    return queryEnginePath
  }

  private handlePanic(): void {
    this.child?.kill()
    if (this.currentRequestPromise) {
      this.currentRequestPromise.cancel()
    }
  }

  private async resolvePrismaPath(): Promise<{
    prismaPath: string
    searchedLocations: string[]
  }> {
    const searchedLocations: string[] = []
    let enginePath
    if (this.prismaPath) {
      return { prismaPath: this.prismaPath, searchedLocations }
    }

    const platform = await this.getPlatform()
    if (this.platform && this.platform !== platform) {
      this.incorrectlyPinnedBinaryTarget = this.platform
    }

    this.platform = this.platform || platform

    if (__filename.includes('NodeEngine')) {
      enginePath = this.getQueryEnginePath(this.platform, getEnginesPath())
      return { prismaPath: enginePath, searchedLocations }
    }
    const searchLocations: string[] = [
      eval(`require('path').join(__dirname, '../../../.prisma/client')`), // Dot Prisma Path
      this.generator?.output ?? eval('__dirname'), // Custom Generator Path
      path.join(eval('__dirname'), '..'), // parentDirName
      path.dirname(this.datamodelPath), // Datamodel Dir
      this.cwd, //cwdPath
    ]

    if (this.dirname) {
      searchLocations.push(this.dirname)
    }

    for (const location of searchLocations) {
      searchedLocations.push(location)
      debug(`Search for Query Engine in ${location}`)
      enginePath = this.getQueryEnginePath(this.platform, location)
      if (fs.existsSync(enginePath)) {
        return { prismaPath: enginePath, searchedLocations }
      }
    }
    enginePath = this.getQueryEnginePath(this.platform)

    return { prismaPath: enginePath ?? '', searchedLocations }
  }

  // get prisma path
  private async getPrismaPath(): Promise<string> {
    const { prismaPath, searchedLocations } = await this.resolvePrismaPath()
    const platform = await this.getPlatform()
    // If path to query engine doesn't exist, throw
    if (!(await exists(prismaPath))) {
      const pinnedStr = this.incorrectlyPinnedBinaryTarget
        ? `\nYou incorrectly pinned it to ${chalk.redBright.bold(
            `${this.incorrectlyPinnedBinaryTarget}`,
          )}\n`
        : ''

      let errorText = `Query engine binary for current platform "${chalk.bold(
        platform,
      )}" could not be found.${pinnedStr}
This probably happens, because you built Prisma Client on a different platform.
(Prisma Client looked in "${chalk.underline(prismaPath)}")

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
      if (this.generator) {
        // The user already added it, but it still doesn't work 🤷‍♀️
        // That means, that some build system just deleted the files 🤔
        if (
          this.generator.binaryTargets.includes(this.platform!) ||
          this.generator.binaryTargets.includes('native')
        ) {
          errorText += `
You already added the platform${
            this.generator.binaryTargets.length > 1 ? 's' : ''
          } ${this.generator.binaryTargets
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

    if (process.platform !== 'win32') {
      plusX(prismaPath)
    }

    return prismaPath
  }

  private getFixedGenerator(): string {
    const fixedGenerator = {
      ...this.generator!,
      binaryTargets: fixBinaryTargets(
        this.generator!.binaryTargets as Platform[],
        this.platform!,
      ),
    }

    return printGeneratorConfig(fixedGenerator)
  }

  printDatasources(): string {
    if (this.datasources) {
      return JSON.stringify(this.datasources)
    }

    return '[]'
  }

  /**
   * Starts the engine, returns the url that it runs on
   */
  async start(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (!this.startPromise) {
      this.startCount++
      this.startPromise = this.internalStart()
    }
    return this.startPromise
  }

  private getEngineEnvVars() {
    const env: any = {
      PRISMA_DML_PATH: this.datamodelPath,
      RUST_BACKTRACE: '1',
      RUST_LOG: 'info',
    }

    if (!this.useUds) {
      env.PORT = String(this.port)
      debug(`port: ${this.port}`)
    }

    if (this.logQueries || this.logLevel === 'info') {
      env.RUST_LOG = 'info'
      if (this.logQueries) {
        env.LOG_QUERIES = 'true'
      }
    }

    if (this.datasources) {
      env.OVERWRITE_DATASOURCES = this.printDatasources()
    }

    if (!process.env.NO_COLOR && this.showColors) {
      env.CLICOLOR_FORCE = '1'
    }

    return {
      ...this.env, // user-provided env vars
      ...process.env,
      ...env,
    }
  }

  private internalStart(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      await new Promise((r) => process.nextTick(r))
      if (this.stopPromise) {
        await this.stopPromise
      }
      if (this.engineEndpoint) {
        try {
          await pRetry(() => this.undici!.status(), {
            retries: 10,
          })
        } catch (e) {
          return reject(e)
        }
        return resolve()
      }
      try {
        if (this.child?.connected || (this.child && !this.child?.killed)) {
          debug(`There is a child that still runs and we want to start again`)
        }

        // reset last panic
        this.lastRustError = undefined
        this.lastErrorLog = undefined
        this.lastPanic = undefined
        logger('startin & resettin')
        this.globalKillSignalReceived = undefined

        if (this.useUds) {
          this.socketPath = `/tmp/prisma-${getRandomString()}.sock`
          socketPaths.push(this.socketPath)
        }

        debug({ cwd: this.cwd })

        const prismaPath = await this.getPrismaPath()
        const experimentalFlags =
          this.enableExperimental &&
          Array.isArray(this.enableExperimental) &&
          this.enableExperimental.length > 0
            ? [`--enable-experimental=${this.enableExperimental.join(',')}`]
            : []

        const debugFlag = this.enableEngineDebugMode ? ['--debug'] : []

        const flags = [
          ...experimentalFlags,
          ...debugFlag,
          '--enable-raw-queries',
          ...this.flags,
        ]

        if (this.useUds) {
          flags.push('--unix-path', this.socketPath!)
        }

        debug({ flags })

        this.port = await this.getFreePort()
        const env = this.getEngineEnvVars()

        this.child = spawn(prismaPath, flags, {
          env,
          cwd: this.cwd,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })

        byline(this.child.stderr).on('data', (msg) => {
          const data = String(msg)
          debug('stderr', data)

          try {
            const json = JSON.parse(data)
            if (typeof json.is_panic !== 'undefined') {
              debug(json)
              this.setError(json)
              if (this.engineStartDeferred) {
                const err = new PrismaClientInitializationError(
                  json.message,
                  this.clientVersion!,
                )
                this.engineStartDeferred.reject(err)
              }
            }
          } catch (e) {
            if (
              !data.includes('Printing to stderr') &&
              !data.includes('Listening on ')
            ) {
              this.stderrLogs += '\n' + data
            }
          }
        })

        byline(this.child.stdout).on('data', (msg) => {
          const data = String(msg)
          try {
            const json = JSON.parse(data)
            debug('stdout', getMessage(json))
            if (
              this.engineStartDeferred &&
              json.level === 'INFO' &&
              json.target === 'query_engine::server' &&
              json.fields?.message?.startsWith('Started http server')
            ) {
              if (this.useUds) {
                this.undici = new Undici(
                  {
                    hostname: 'localhost',
                    protocol: 'http:',
                  },
                  {
                    socketPath: this.socketPath,
                  },
                )
              } else {
                this.undici = new Undici(`http://localhost:${this.port}`)
              }
              this.engineStartDeferred.resolve()
              this.engineStartDeferred = undefined
            }

            // only emit logs, if they're in the from of a log
            // they could also be a RustError, which has is_panic
            // these logs can still include error logs
            if (typeof json.is_panic === 'undefined') {
              const log = convertLog(json)
              // boolean cast needed, because of TS. We return ` is RustLog`, useful in other context, but not here
              const logIsRustErrorLog: boolean = isRustErrorLog(log)
              if (logIsRustErrorLog) {
                this.setError(log)
              } else {
                this.logEmitter.emit(log.level, log)
              }
            } else {
              this.setError(json)
            }
          } catch (e) {
            debug(e, data)
          }
        })

        this.child.on('exit', (code): void => {
          logger('removing startPromise')
          this.startPromise = undefined
          if (this.engineStopDeferred) {
            this.engineStopDeferred.resolve(code)
            return
          }
          this.undici?.close()

          // don't error in restarts
          if (code !== 0 && this.engineStartDeferred && this.startCount === 1) {
            let err
            let msg = this.stderrLogs
            if (this.lastRustError) {
              msg = getMessage(this.lastRustError)
            } else if (this.lastErrorLog) {
              msg = getMessage(this.lastErrorLog)
            }
            if (code !== null) {
              err = new PrismaClientInitializationError(
                `Query engine exited with code ${code}\n` + msg,
                this.clientVersion!,
              )
            } else if (this.child?.signalCode) {
              err = new PrismaClientInitializationError(
                `Query engine process killed with signal ${this.child.signalCode} for unknown reason.
Make sure that the engine binary at ${prismaPath} is not corrupt.\n` + msg,
                this.clientVersion!,
              )
            } else {
              err = new PrismaClientInitializationError(
                msg,
                this.clientVersion!,
              )
            }

            this.engineStartDeferred.reject(err)
          }
          if (!this.child) {
            return
          }
          if (this.lastRustError) {
            return
          }
          if (code === 126) {
            this.setError({
              timestamp: new Date(),
              target: 'exit',
              level: 'error',
              fields: {
                message: `Couldn't start query engine as it's not executable on this operating system.
You very likely have the wrong "binaryTarget" defined in the schema.prisma file.`,
              },
            })
          }
        })

        this.child.on('error', (err): void => {
          this.setError({
            message: err.message,
            backtrace: 'Could not start query engine',
            is_panic: false,
          })
          reject(err)
        })

        this.child.on('close', (code, signal): void => {
          this.undici?.close()
          if (code === null && signal === 'SIGABRT' && this.child) {
            const error = new PrismaClientRustPanicError(
              this.getErrorMessageWithLink(
                'Panic in Query Engine with SIGABRT signal',
              ),
              this.clientVersion!,
            )
            this.logEmitter.emit('error', error)
          } else if (
            code === 255 &&
            signal === null &&
            // if there is a "this.lastPanic", the panic has already been handled, so we don't need
            // to look into it anymore
            this.lastErrorLog?.fields.message === 'PANIC' &&
            !this.lastPanic
          ) {
            const error = new PrismaClientRustPanicError(
              this.getErrorMessageWithLink(
                `${this.lastErrorLog.fields.message}: ${this.lastErrorLog.fields.reason} in ${this.lastErrorLog.fields.file}:${this.lastErrorLog.fields.line}:${this.lastErrorLog.fields.column}`,
              ),
              this.clientVersion!,
            )
            this.setError(error)
          }
        })

        if (this.lastRustError) {
          return reject(
            new PrismaClientInitializationError(
              getMessage(this.lastRustError),
              this.clientVersion!,
            ),
          )
        }

        if (this.lastErrorLog) {
          return reject(
            new PrismaClientInitializationError(
              getMessage(this.lastErrorLog),
              this.clientVersion!,
            ),
          )
        }

        try {
          await new Promise<void>((resolve, reject) => {
            this.engineStartDeferred = { resolve, reject }
          })
        } catch (err) {
          this.child?.kill()
          throw err
        }

        // don't wait for this
        void (async () => {
          try {
            const engineVersion = await this.version(true)
            debug(`Client Version: ${this.clientVersion}`)
            debug(`Engine Version: ${engineVersion}`)
            debug(`Active provider: ${this.activeProvider}`)
          } catch (e) {
            debug(e)
          }
        })()

        this.stopPromise = undefined
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  }

  async stop(): Promise<void> {
    if (!this.stopPromise) {
      this.stopPromise = this._stop()
    }

    return this.stopPromise
  }

  /**
   * If Prisma runs, stop it
   */
  async _stop(): Promise<void> {
    if (this.startPromise) {
      await this.startPromise
    }
    // not sure yet if this is a good idea
    await new Promise((resolve) => process.nextTick(resolve))
    if (this.currentRequestPromise) {
      try {
        await this.currentRequestPromise
      } catch (e) {
        //
      }
    }
    this.getConfigPromise = undefined
    let stopChildPromise
    if (this.child) {
      debug(`Stopping Prisma engine4`)
      if (this.startPromise) {
        debug(`Waiting for start promise`)
        await this.startPromise
      }
      debug(`Done waiting for start promise`)
      stopChildPromise = new Promise((resolve, reject) => {
        this.engineStopDeferred = { resolve, reject }
      })
      this.undici?.close()
      this.child?.kill()
      this.child = undefined
    }
    if (stopChildPromise) {
      await stopChildPromise
    }
    await new Promise((r) => process.nextTick(r))
    this.startPromise = undefined
    this.engineStopDeferred = undefined
  }

  kill(signal: string): void {
    this.getConfigPromise = undefined
    this.globalKillSignalReceived = signal
    this.child?.kill()
    this.undici?.close()
  }

  /**
   * Use the port 0 trick to get a new port
   */
  protected getFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer((s) => s.end(''))
      server.unref()
      server.on('error', reject)
      server.listen(0, () => {
        const address = server.address()
        const port =
          typeof address === 'string'
            ? parseInt(address.split(':').slice(-1)[0], 10)
            : address!.port
        server.close((e) => {
          if (e) {
            reject(e)
          }
          resolve(port)
        })
      })
    })
  }

  async getConfig(): Promise<GetConfigResult> {
    if (!this.getConfigPromise) {
      this.getConfigPromise = this._getConfig()
    }
    return this.getConfigPromise
  }

  async _getConfig(): Promise<GetConfigResult> {
    const prismaPath = await this.getPrismaPath()

    const env = await this.getEngineEnvVars()

    const result = await execa(prismaPath, ['cli', 'get-config'], {
      env: omit(env, ['PORT']),
      cwd: this.cwd,
    })

    return JSON.parse(result.stdout)
  }

  async version(forceRun = false) {
    if (this.versionPromise && !forceRun) {
      return this.versionPromise
    }
    this.versionPromise = this.internalVersion()
    return this.versionPromise
  }

  async internalVersion() {
    const prismaPath = await this.getPrismaPath()

    const result = await execa(prismaPath, ['--version'])

    this.lastVersion = result.stdout
    return this.lastVersion
  }

  async request<T>(
    query: string,
    headers: Record<string, string>,
    numTry = 1,
  ): Promise<T> {
    if (this.stopPromise) {
      await this.stopPromise
    }
    await this.start()

    if (!this.child && !this.engineEndpoint) {
      throw new PrismaClientUnknownRequestError(
        `Can't perform request, as the Engine has already been stopped`,
        this.clientVersion!,
      )
    }

    this.currentRequestPromise = this.undici!.request(
      stringifyQuery(query),
      headers,
    )
    this.lastQuery = query

    try {
      const { data, headers } = await this.currentRequestPromise
      if (data.errors) {
        if (data.errors.length === 1) {
          throw this.graphQLToJSError(data.errors[0])
        }
        // this case should not happen, as the query engine only returns one error
        throw new PrismaClientUnknownRequestError(
          JSON.stringify(data.errors),
          this.clientVersion!,
        )
      }

      // Rust engine returns time in microseconds and we want it in miliseconds
      const elapsed = parseInt(headers['x-elapsed']) / 1000

      // reset restart count after successful request
      if (this.startCount > 0) {
        this.startCount = 0
      }

      this.currentRequestPromise = undefined
      return { data, elapsed } as any
    } catch (error) {
      logger('req - e', error)
      if (error instanceof PrismaClientKnownRequestError) {
        throw error
      }

      await this.handleRequestError(error, numTry <= MAX_REQUEST_RETRIES)
      // retry
      if (numTry <= MAX_REQUEST_RETRIES) {
        logger('trying a retry now')
        return this.request(query, headers, numTry + 1)
      }
    }

    return null as any // needed to make TS happy
  }

  async requestBatch<T>(
    queries: string[],
    transaction = false,
    numTry = 1,
  ): Promise<T> {
    await this.start()

    if (!this.child && !this.engineEndpoint) {
      throw new PrismaClientUnknownRequestError(
        `Can't perform request, as the Engine has already been stopped`,
        this.clientVersion!,
      )
    }

    const variables = {}
    const body = {
      batch: queries.map((query) => ({ query, variables })),
      transaction,
    }

    const stringifiedQuery = JSON.stringify(body)

    this.currentRequestPromise = this.undici!.request(stringifiedQuery)

    this.lastQuery = stringifiedQuery

    return this.currentRequestPromise
      .then(({ data, headers }) => {
        // Rust engine returns time in microseconds and we want it in miliseconds
        const elapsed = parseInt(headers['x-elapsed']) / 1000
        if (Array.isArray(data)) {
          return data.map((result) => {
            if (result.errors) {
              return this.graphQLToJSError(result.errors[0])
            }
            return {
              data: result,
              elapsed,
            }
          })
        } else {
          if (data.errors && data.errors.length === 1) {
            throw new Error(data.errors[0].error)
          }
          throw new Error(JSON.stringify(data))
        }
      })
      .catch(async (e) => {
        const isError = await this.handleRequestError(e, numTry < 3)
        if (!isError) {
          // retry
          if (numTry <= MAX_REQUEST_RETRIES) {
            return this.requestBatch(queries, transaction, numTry + 1)
          }
        }

        throw isError
      })
  }

  private get hasMaxRestarts() {
    return this.startCount >= MAX_STARTS
  }

  /**
   * If we have request errors like "ECONNRESET", we need to get the error from a
   * different place, not the request itself. This different place can either be
   * this.lastRustError or this.lastErrorLog
   */
  private throwAsyncErrorIfExists(forceThrow = false) {
    logger('throwAsyncErrorIfExists', this.startCount, this.hasMaxRestarts)
    if (this.lastRustError) {
      const err = new PrismaClientRustPanicError(
        this.getErrorMessageWithLink(getMessage(this.lastRustError)),
        this.clientVersion!,
      )
      if (this.lastRustError.is_panic) {
        this.lastPanic = err
      }
      if (this.hasMaxRestarts || forceThrow) {
        throw err
      }
    }

    if (this.lastErrorLog && isRustErrorLog(this.lastErrorLog)) {
      const err = new PrismaClientUnknownRequestError(
        this.getErrorMessageWithLink(getMessage(this.lastErrorLog)),
        this.clientVersion!,
      )

      if (this.lastErrorLog?.fields?.message === 'PANIC') {
        this.lastPanic = err
      }

      if (this.hasMaxRestarts || forceThrow) {
        throw err
      }
    }
  }

  private getErrorMessageWithLink(title: string) {
    return getErrorMessageWithLink({
      platform: this.platform,
      title,
      version: this.clientVersion!,
      engineVersion: this.lastVersion,
      database: this.lastActiveProvider,
      query: this.lastQuery!,
    })
  }

  private handleRequestError = async (
    error: Error & { code?: string },
    graceful = false,
  ) => {
    debug({ error })
    // if we are starting, wait for it before we handle any error
    if (this.startPromise) {
      await this.startPromise
    }

    this.throwAsyncErrorIfExists()

    // A currentRequestPromise is only being canceled by the sendPanic function
    if (this.currentRequestPromise?.isCanceled) {
      this.throwAsyncErrorIfExists()
    } else if (
      // matching on all relevant error codes from
      // https://github.com/nodejs/undici/blob/2.x/lib/core/errors.js
      error.code === 'ECONNRESET' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'UND_ERR_CLOSED' ||
      error.code === 'UND_ERR_SOCKET' ||
      error.code === 'UND_ERR_DESTROYED' ||
      error.code === 'UND_ERR_ABORTED' ||
      error.message.toLowerCase().includes('client is destroyed') ||
      error.message.toLowerCase().includes('other side closed') ||
      error.message.toLowerCase().includes('the client is closed')
    ) {
      if (this.globalKillSignalReceived && !this.child?.connected) {
        throw new PrismaClientUnknownRequestError(
          `The Node.js process already received a ${this.globalKillSignalReceived} signal, therefore the Prisma query engine exited
and your request can't be processed.
You probably have some open handle that prevents your process from exiting.
It could be an open http server or stream that didn't close yet.
We recommend using the \`wtfnode\` package to debug open handles.`,
          this.clientVersion!,
        )
      }

      this.throwAsyncErrorIfExists()

      if (this.startCount > MAX_STARTS) {
        // if we didn't throw yet, which is unlikely, we want to poll on stderr / stdout here
        // to get an error first
        for (let i = 0; i < 5; i++) {
          await new Promise((r) => setTimeout(r, 50))
          this.throwAsyncErrorIfExists(true)
        }
        throw new Error(`Query engine is trying to restart, but can't.
Please look into the logs or turn on the env var DEBUG=* to debug the constantly restarting query engine.`)
      }
    }

    if (!graceful) {
      this.throwAsyncErrorIfExists(true)
      throw error
    }

    return false
  }

  private graphQLToJSError(
    error: RequestError,
  ): PrismaClientKnownRequestError | PrismaClientUnknownRequestError {
    if (error.user_facing_error.error_code) {
      return new PrismaClientKnownRequestError(
        error.user_facing_error.message,
        error.user_facing_error.error_code,
        this.clientVersion!,
        error.user_facing_error.meta,
      )
    }

    return new PrismaClientUnknownRequestError(
      error.user_facing_error.message,
      this.clientVersion!,
    )
  }
}

// faster than creating a new object and JSON.stringify it all the time
function stringifyQuery(q: string) {
  return `{"variables":{},"query":${JSON.stringify(q)}}`
}

function hookProcess(handler: string, exit = false) {
  process.once(handler as any, async () => {
    for (const engine of engines) {
      await engine.emitExit()
      engine.kill(handler)
    }
    engines.splice(0, engines.length)

    if (socketPaths.length > 0) {
      for (const socketPath of socketPaths) {
        try {
          fs.unlinkSync(socketPath)
        } catch (e) {
          //
        }
      }
    }

    // only exit, if only we are listening
    // if there is another listener, that other listener is responsible
    if (exit && process.listenerCount(handler) === 0) {
      process.exit()
    }
  })
}

hookProcess('beforeExit')
hookProcess('exit')
hookProcess('SIGINT', true)
hookProcess('SIGUSR1', true)
hookProcess('SIGUSR2', true)
hookProcess('SIGTERM', true)
