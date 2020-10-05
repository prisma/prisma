import {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  RequestError,
  PrismaClientInitializationError,
  PrismaClientRustPanicError,
  getMessage,
  getErrorMessageWithLink,
} from './Engine'
import debugLib from 'debug'
import { getPlatform, Platform } from '@prisma/get-platform'
import path from 'path'
import net from 'net'
import fs from 'fs'
import os from 'os'
import chalk from 'chalk'
import { GeneratorConfig, DataSource } from '@prisma/generator-helper'
import { printGeneratorConfig } from './printGeneratorConfig'
import { fixBinaryTargets, plusX, getRandomString } from './util'
import { promisify } from 'util'
import EventEmitter from 'events'
import { convertLog, RustLog, RustError } from './log'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import byline from './byline'
import pRetry from 'p-retry'
import execa from 'execa'
import { omit } from './omit'
import { Undici } from './undici'

const debug = debugLib('engine')
const exists = promisify(fs.exists)
const readdir = promisify(fs.readdir)

export interface DatasourceOverwrite {
  name: string
  url: string
}

export interface EngineConfig {
  cwd?: string
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

  clientVersion?: string
  enableExperimental?: string[]
  engineEndpoint?: string
  useUds?: boolean
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

const engines: NodeEngine[] = []
const socketPaths: string[] = []

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
  private child?: ChildProcessWithoutNullStreams
  private clientVersion?: string
  private lastPanic?: Error
  private globalKillSignalReceived?: string
  private restartCount: number = 0
  private backoffPromise?: Promise<any>
  private queryEngineStarted: boolean = false
  private enableExperimental: string[] = []
  private engineEndpoint?: string
  private lastLog?: RustLog
  private lastErrorLog?: RustLog
  private lastError?: RustError
  private useUds: boolean = false
  private socketPath?: string
  private getConfigPromise?: Promise<GetConfigResult>
  private stopPromise?: Promise<void>
  exitCode: number
  /**
   * exiting is used to tell the .on('exit') hook, if the exit came from our script.
   * As soon as the Prisma binary returns a correct return code (like 1 or 0), we don't need this anymore
   */
  queryEngineKilled = false
  managementApiEnabled = false
  datamodelJson?: string
  cwd: string
  datamodelPath: string
  prismaPath?: string
  url: string
  ready = false
  stderrLogs = ''
  stdoutLogs = ''
  currentRequestPromise?: any
  cwdPromise: Promise<string>
  platformPromise: Promise<Platform>
  platform?: Platform | string
  generator?: GeneratorConfig
  incorrectlyPinnedBinaryTarget?: string
  datasources?: DatasourceOverwrite[]
  startPromise?: Promise<any>
  engineStartDeferred?: Deferred
  engineStopDeferred?: StopDeferred
  undici: Undici
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
    useUds,
  }: EngineConfig) {
    this.env = env
    this.cwd = this.resolveCwd(cwd)
    this.enableDebugLogs = enableDebugLogs ?? false
    this.enableEngineDebugMode = enableEngineDebugMode ?? false
    this.datamodelPath = datamodelPath
    this.prismaPath = process.env.PRISMA_QUERY_ENGINE_BINARY ?? prismaPath
    this.generator = generator
    this.datasources = datasources
    this.logEmitter = new EventEmitter()
    this.showColors = showColors ?? false
    this.logLevel = logLevel
    this.logQueries = logQueries ?? false
    this.clientVersion = clientVersion
    this.flags = flags ?? []
    this.enableExperimental = enableExperimental ?? []
    const removedFlags = [
      'middlewares',
      'aggregateApi',
      'distinct',
      'aggregations',
      'insensitiveFilters'
    ]
    const removedFlagsUsed = this.enableExperimental.filter((e) =>
      removedFlags.includes(e),
    )
    if (removedFlagsUsed.length > 0) {
      console.log(
        `${chalk.blueBright('info')} The preview flags \`${removedFlagsUsed.join(
          '`, `',
        )}\` were removed, you can now safely remove them from your schema.prisma.`,
      )
    }
    this.enableExperimental = this.enableExperimental.filter(
      (e) => !removedFlags.includes(e),
    )
    this.engineEndpoint = engineEndpoint

    // TODO enable again if this doesn't work as intended
    if (useUds && process.platform !== 'win32') {
      // if (process.platform !== 'win32') {
      this.socketPath = `/tmp/prisma-${getRandomString()}.sock`
      socketPaths.push(this.socketPath)
      this.useUds = useUds
    }

    if (engineEndpoint) {
      const url = new URL(engineEndpoint)
      this.port = Number(url.port)
    }

    this.logEmitter.on('error', (log: RustLog | Error) => {
      if (this.enableDebugLogs) {
        debugLib('engine:log')(log)
      }
      if (log instanceof Error) {
        debugLib('engine:error')(log)
      } else {
        this.lastErrorLog = log
        if (log.fields.message === 'PANIC') {
          this.handlePanic(log)
        }
      }
    })

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
          this.clientVersion,
        )
      }
    } else {
      this.getPlatform()
    }
    if (this.enableDebugLogs) {
      debugLib.enable('*')
    }
    engines.push(this)
  }

  private resolveCwd(cwd?: string): string {
    if (cwd && fs.existsSync(cwd) && fs.lstatSync(cwd).isDirectory()) {
      return cwd
    }

    return process.cwd()
  }

  on(
    event: 'query' | 'info' | 'warn' | 'error',
    listener: (log: RustLog) => any,
  ): void {
    this.logEmitter.on(event, listener)
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private handlePanic(log: RustLog): void {
    this.child?.kill()
    if (this.currentRequestPromise) {
      this.currentRequestPromise.cancel()
    }
  }

  private async resolvePrismaPath(): Promise<string> {
    if (this.prismaPath) {
      return this.prismaPath
    }

    const platform = await this.getPlatform()
    if (this.platform && this.platform !== platform) {
      this.incorrectlyPinnedBinaryTarget = this.platform
    }

    this.platform = this.platform || platform

    const fileName = eval(`require('path').basename(__filename)`)
    if (fileName === 'NodeEngine.js') {
      return this.getQueryEnginePath(
        this.platform,
        path.resolve(__dirname, `..`),
      )
    } else {
      const dotPrismaPath = await this.getQueryEnginePath(
        this.platform,
        eval(`require('path').join(__dirname, '../../../.prisma/client')`),
      )
      debug({ dotPrismaPath })
      if (fs.existsSync(dotPrismaPath)) {
        return dotPrismaPath
      }
      const dirnamePath = await this.getQueryEnginePath(
        this.platform,
        this.generator.output ? this.generator.output : eval('__dirname') ,
      )
      debug({ dirnamePath })
      if (fs.existsSync(dirnamePath)) {
        return dirnamePath
      }
      const parentDirName = await this.getQueryEnginePath(
        this.platform,
        path.join(eval('__dirname'), '..'),
      )
      debug({ parentDirName })
      if (fs.existsSync(parentDirName)) {
        return parentDirName
      }
      const datamodelDirName = await this.getQueryEnginePath(
        this.platform,
        path.dirname(this.datamodelPath),
      )
      if (fs.existsSync(datamodelDirName)) {
        return datamodelDirName
      }
      const cwdPath = await this.getQueryEnginePath(this.platform, this.cwd)
      if (fs.existsSync(cwdPath)) {
        return cwdPath
      }
      const prismaPath = await this.getQueryEnginePath(this.platform)
      debug({ prismaPath })
      return prismaPath
    }
  }

  // get prisma path
  private async getPrismaPath(): Promise<string> {
    const prismaPath = await this.resolvePrismaPath()
    const platform = await this.getPlatform()
    // If path to query engine doesn't exist, throw
    if (!(await exists(prismaPath))) {
      const pinnedStr = this.incorrectlyPinnedBinaryTarget
        ? `\nYou incorrectly pinned it to ${chalk.redBright.bold(
            `${this.incorrectlyPinnedBinaryTarget}`,
          )}\n`
        : ''

      const dir = path.dirname(prismaPath)
      const dirExists = fs.existsSync(dir)
      let files = []
      if (dirExists) {
        files = await readdir(dir)
      }
      let errorText = `Query engine binary for current platform "${chalk.bold(
        platform,
      )}" could not be found.${pinnedStr}
This probably happens, because you built Prisma Client on a different platform.
(Prisma Client looked in "${chalk.underline(prismaPath)}")

Files in ${dir}:

${files.map((f) => `  ${f}`).join('\n')}\n`

      // The generator should always be there during normal usage
      if (this.generator) {
        // The user already added it, but it still doesn't work 🤷‍♀️
        // That means, that some build system just deleted the files 🤔
        if (
          this.generator.binaryTargets.includes(this.platform) ||
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

      throw new PrismaClientInitializationError(errorText, this.clientVersion)
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
      ...this.generator,
      binaryTargets: fixBinaryTargets(
        this.generator.binaryTargets as Platform[],
        this.platform,
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
      this.startPromise = this.internalStart()
    }
    return this.startPromise
  }

  private async getEngineEnvVars() {
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
          await pRetry(() => this.undici.status(), {
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
        this.queryEngineStarted = false

        // reset last panic
        this.lastError = undefined
        this.lastErrorLog = undefined
        this.lastPanic = undefined
        this.queryEngineKilled = false
        this.globalKillSignalReceived = undefined

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
          flags.push('--unix-path', this.socketPath)
        }

        debug({ flags })

        this.port = await this.getFreePort()
        const env = await this.getEngineEnvVars()

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
              this.lastError = json
              if (this.engineStartDeferred) {
                const err = new PrismaClientInitializationError(
                  this.lastError.message,
                  this.clientVersion,
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
            debug('stdout', json)
            if (
              this.engineStartDeferred &&
              json.level === 'INFO' &&
              json.target === 'query_engine::server' &&
              json.fields?.message.startsWith('Started http server')
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
              this.queryEngineStarted = true
            }
            if (typeof json.is_panic === 'undefined') {
              const log = convertLog(json)
              this.logEmitter.emit(log.level, log)
              this.lastLog = log
            } else {
              this.lastError = json
            }
          } catch (e) {
            debug(e, data)
          }
        })

        this.child.on('exit', (code): void => {
          if (this.engineStopDeferred) {
            this.engineStopDeferred.resolve(code)
            return
          }
          this.undici?.close()
          this.exitCode = code
          if (
            !this.queryEngineKilled &&
            this.queryEngineStarted &&
            this.restartCount < 5
          ) {
            pRetry(
              async (attempt) => {
                debug(`Restart attempt ${attempt}. Waiting for backoff`)
                if (this.backoffPromise) {
                  await this.backoffPromise
                }
                debug(`Restart attempt ${attempt}. Backoff done`)
                this.restartCount++
                //  TODO: look into this
                const wait =
                  Math.random() * 2 * Math.pow(Math.E, this.restartCount)
                this.startPromise = undefined
                this.backoffPromise = new Promise((r) => setTimeout(r, wait))
                return this.start()
              },
              {
                retries: 4,
                randomize: true, // full jitter
                minTimeout: 1000,
                maxTimeout: 60 * 1000,
                factor: Math.E,
                onFailedAttempt: (e) => {
                  debug(e)
                },
              },
            )
            return
          }
          if (code !== 0 && this.engineStartDeferred) {
            let err
            if (code !== null) {
              err = new PrismaClientInitializationError(
                `Query engine exited with code ${code}\n` + this.stderrLogs,
                this.clientVersion,
              )
            } else if (this.child?.signalCode) {
              err = new PrismaClientInitializationError(
                `Query engine process killed with signal ${this.child.signalCode} for unknown reason.
Make sure that the engine binary at ${prismaPath} is not corrupt.\n` +
                  this.stderrLogs,
                this.clientVersion,
              )
            } else {
              err = new PrismaClientInitializationError(
                this.stderrLogs,
                this.clientVersion,
              )
            }

            this.engineStartDeferred.reject(err)
          }
          if (!this.child) {
            return
          }
          if (this.lastError) {
            return
          }
          if (this.lastErrorLog) {
            this.lastErrorLog.target = 'exit'
            return
          }
          if (code === 126) {
            this.lastErrorLog = {
              timestamp: new Date(),
              target: 'exit',
              level: 'error',
              fields: {
                message: `Couldn't start query engine as it's not executable on this operating system.
You very likely have the wrong "binaryTarget" defined in the schema.prisma file.`,
              },
            }
          } else {
            this.lastErrorLog = {
              target: 'exit',
              timestamp: new Date(),
              level: 'error',
              fields: {
                message:
                  (this.stderrLogs || '') +
                  (this.stdoutLogs || '') +
                  `\nExit code: ${code}`,
              },
            }
          }
        })

        this.child.on('error', (err): void => {
          this.lastError = {
            message: err.message,
            backtrace: 'Could not start query engine',
            is_panic: false, // eslint-disable-line @typescript-eslint/camelcase
          }
          reject(err)
        })

        this.child.on('close', (code, signal): void => {
          this.undici?.close()
          if (code === null && signal === 'SIGABRT' && this.child) {
            const error = new PrismaClientRustPanicError(
              getErrorMessageWithLink({
                platform: this.platform,
                title: `Panic in Query Engine with SIGABRT signal`,
                description: this.stderrLogs,
                version: this.clientVersion,
              }),
              this.clientVersion,
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
              getErrorMessageWithLink({
                platform: this.platform,
                title: `${this.lastErrorLog.fields.message}: ${this.lastErrorLog.fields.reason} in
${this.lastErrorLog.fields.file}:${this.lastErrorLog.fields.line}:${this.lastErrorLog.fields.column}`,
                version: this.clientVersion,
              }),
              this.clientVersion,
            )
            this.logEmitter.emit('error', error)
          }
        })

        if (this.lastError) {
          return reject(
            new PrismaClientInitializationError(
              getMessage(this.lastError),
              this.clientVersion,
            ),
          )
        }

        if (this.lastErrorLog) {
          return reject(
            new PrismaClientInitializationError(
              getMessage(this.lastErrorLog),
              this.clientVersion,
            ),
          )
        }

        try {
          await new Promise((resolve, reject) => {
            this.engineStartDeferred = { resolve, reject }
          })
        } catch (err) {
          this.child?.kill()
          throw err
        }

        this.url = `http://localhost:${this.port}`

        // don't wait for this
        ;(async () => {
          const engineVersion = await this.version()
          debug(`Client Version ${this.clientVersion}`)
          debug(`Engine Version ${engineVersion}`)
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
      this.queryEngineKilled = true
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
    setTimeout(() => {
      if (this.socketPath) {
        try {
          fs.unlinkSync(this.socketPath)
        } catch (e) {
          debug(e)
          //
        }
        socketPaths.splice(socketPaths.indexOf(this.socketPath), 1)
        this.socketPath = undefined
      }
    })
  }

  async kill(signal: string): Promise<void> {
    this.getConfigPromise = undefined
    this.globalKillSignalReceived = signal
    this.queryEngineKilled = true
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
            : address.port
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

  async version() {
    const prismaPath = await this.getPrismaPath()

    const result = await execa(prismaPath, ['--version'], {
      env: {
        ...process.env,
      },
    })

    return result.stdout
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
        this.clientVersion,
      )
    }


    this.currentRequestPromise = this.undici.request(
      stringifyQuery(query),
      headers,
    )

    return this.currentRequestPromise
      .then(({ data, headers }) => {
        if (data.errors) {
          if (data.errors.length === 1) {
            throw this.graphQLToJSError(data.errors[0])
          }
          // this case should not happen, as the query engine only returns one error
          throw new Error(JSON.stringify(data.errors))
        }

        // Rust engine returns time in microseconds and we want it in miliseconds
        const elapsed = parseInt(headers['x-elapsed']) / 1000

        // reset restart count after successful request
        if (this.restartCount > 0) {
          this.restartCount = 0
        }

        return { data, elapsed }
      })

      .catch(async (e) => {
        const isError = await this.handleRequestError(e, numTry < 3)
        if (!isError) {
          // retry
          if (numTry < 3) {
            await new Promise((r) => setTimeout(r, Math.random() * 1000))
            return this.request(query, headers, numTry + 1)
          }
        }
        throw isError
      })
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
        this.clientVersion,
      )
    }

    const variables = {}
    const body = {
      batch: queries.map((query) => ({ query, variables })),
      transaction,
    }

    this.currentRequestPromise = this.undici.request(JSON.stringify(body))

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
          if (numTry < 3) {
            await new Promise((r) => setTimeout(r, Math.random() * 1000))
            return this.requestBatch(queries, transaction, numTry + 1)
          }
        }

        throw isError
      })
  }

  private handleRequestError = async (
    error: Error & { code?: string },
    graceful: boolean,
  ) => {
    debug({ error })
    let err
    if (this.currentRequestPromise.isCanceled && this.lastError) {
      // TODO: Replace these errors with known or unknown request errors
      if (this.lastError.is_panic) {
        err = new PrismaClientRustPanicError(
          getErrorMessageWithLink({
            platform: this.platform,
            title: getMessage(this.lastError),
            version: this.clientVersion,
          }),
          this.clientVersion,
        )
        this.lastPanic = err
      } else {
        err = new PrismaClientUnknownRequestError(
          getErrorMessageWithLink({
            platform: this.platform,
            title: getMessage(this.lastError),
            version: this.clientVersion,
          }),
          this.clientVersion,
        )
      }
    } else if (this.currentRequestPromise.isCanceled && this.lastErrorLog) {
      if (this.lastErrorLog?.fields?.message === 'PANIC') {
        err = new PrismaClientRustPanicError(
          getErrorMessageWithLink({
            platform: this.platform,
            title: getMessage(this.lastErrorLog),
            version: this.clientVersion,
          }),
          this.clientVersion,
        )
        this.lastPanic = err
      } else {
        err = new PrismaClientUnknownRequestError(
          getErrorMessageWithLink({
            platform: this.platform,
            title: getMessage(this.lastErrorLog),
            version: this.clientVersion,
          }),
          this.clientVersion,
        )
      }
    } else if (
      (error.code && error.code === 'ECONNRESET') ||
      error.code === 'ECONNREFUSED' ||
      (error.code === 'UND_ERR_SOCKET' &&
        error.message.toLowerCase().includes('closed')) ||
      error.message.toLowerCase().includes('client is destroyed') ||
      error.message.toLowerCase().includes('other side closed') || (
        error.code === 'UND_ERR_CLOSED'
      )
    ) {
      if (this.globalKillSignalReceived && !this.child.connected) {
        throw new PrismaClientUnknownRequestError(
          `The Node.js process already received a ${this.globalKillSignalReceived} signal, therefore the Prisma query engine exited
and your request can't be processed.
You probably have some open handle that prevents your process from exiting.
It could be an open http server or stream that didn't close yet.
We recommend using the \`wtfnode\` package to debug open handles.`,
          this.clientVersion,
        )
      }

      if (this.restartCount > 4) {
        throw new Error(`Query engine is trying to restart, but can't.
Please look into the logs or turn on the env var DEBUG=* to debug the constantly restarting query engine.`)
      }

      if (this.lastError) {
        if (this.lastError.is_panic) {
          err = new PrismaClientRustPanicError(
            getErrorMessageWithLink({
              platform: this.platform,
              title: getMessage(this.lastError),
              version: this.clientVersion,
            }),
            this.clientVersion,
          )
          this.lastPanic = err
        } else {
          err = new PrismaClientUnknownRequestError(
            getErrorMessageWithLink({
              platform: this.platform,
              title: getMessage(this.lastError),
              version: this.clientVersion,
            }),
            this.clientVersion,
          )
        }
      } else if (this.lastErrorLog) {
        if (this.lastErrorLog?.fields?.message === 'PANIC') {
          err = new PrismaClientRustPanicError(
            getErrorMessageWithLink({
              platform: this.platform,
              title: getMessage(this.lastErrorLog),
              version: this.clientVersion,
            }),
            this.clientVersion,
          )
          this.lastPanic = err
        } else {
          err = new PrismaClientUnknownRequestError(
            getErrorMessageWithLink({
              platform: this.platform,
              title: getMessage(this.lastErrorLog),
              version: this.clientVersion,
            }),
            this.clientVersion,
          )
        }
      }
      if (!err) {
        // wait a bit so we get some logs
        let lastLog = this.getLastLog()
        if (!lastLog) {
          await new Promise((r) => setTimeout(r, 500))
          lastLog = this.getLastLog()
        }
        const logs = lastLog || this.stderrLogs || this.stdoutLogs
        let title = lastLog ?? error.message
        let description =
          error.stack + '\nExit code: ' + this.exitCode + '\n' + logs
        description =
          `signalCode: ${this.child?.signalCode} | exitCode: ${this.child?.exitCode} | killed: ${this.child?.killed}\n` +
          description
        err = new PrismaClientUnknownRequestError(
          getErrorMessageWithLink({
            platform: this.platform,
            title,
            version: this.clientVersion,
            description,
          }),
          this.clientVersion,
        )
        debug(err.message)
        if (graceful) {
          return false
        }
      }
    }

    if (err) {
      throw err
    }
    throw error
  }

  private getLastLog(): string | null {
    const message = this.lastLog?.fields?.message

    if (message) {
      const fields = Object.entries(this.lastLog?.fields)
        .filter(([key]) => key !== 'message')
        .map(([key, value]) => {
          return `${key}: ${value}`
        })
        .join(', ')

      if (fields) {
        return `${message}  ${fields}`
      }

      return message
    }

    return null
  }

  private graphQLToJSError(
    error: RequestError,
  ): PrismaClientKnownRequestError | PrismaClientUnknownRequestError {
    if (error.user_facing_error.error_code) {
      return new PrismaClientKnownRequestError(
        error.user_facing_error.message,
        error.user_facing_error.error_code,
        this.clientVersion,
        error.user_facing_error.meta,
      )
    }

    return new PrismaClientUnknownRequestError(
      error.user_facing_error.message,
      this.clientVersion,
    )
  }
}

// faster than creating a new object and JSON.stringify it all the time
function stringifyQuery(q: string) {
  return `{"variables":{},"query":${JSON.stringify(q)}}`
}

function hookProcess(handler: string, exit = false) {
  process.once(handler as any, () => {
    for (const engine of engines) {
      engine.kill(handler)
    }
    engines.splice(0, engines.length)
    if (exit) {
      process.exit()
    }
    if (socketPaths.length > 0) {
      for (const socketPath of socketPaths) {
        try {
          fs.unlinkSync(socketPath)
        } catch (e) {
          //
        }
      }
    }
  })
}

hookProcess('beforeExit')
hookProcess('exit')
hookProcess('SIGINT', true)
hookProcess('SIGUSR1', true)
hookProcess('SIGUSR2', true)
hookProcess('SIGTERM', true)
