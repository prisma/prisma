import {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  RequestError,
  PrismaClientInitializationError,
  PrismaClientRustPanicError,
  getMessage,
  QueryEngineErrorWithLink,
} from './Engine'
import debugLib from 'debug'
import { getPlatform, Platform } from '@prisma/get-platform'
import path from 'path'
import net from 'net'
import fs from 'fs'
import chalk from 'chalk'
import { GeneratorConfig } from '@prisma/generator-helper'
import { printGeneratorConfig } from './printGeneratorConfig'
import { fixPlatforms, plusX, link, getGithubIssueUrl } from './util'
import { promisify } from 'util'
import EventEmitter from 'events'
import { convertLog, RustLog, RustError } from './log'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import byline from './byline'
import bent from 'bent'
import { getLogs } from '@prisma/debug'

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
  debug?: boolean
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
  'windows',
  'freebsd',
  'openbsd',
  'netbsd',
  'arm',
]

export type Deferred = {
  resolve: () => void
  reject: (err: Error) => void
}

const children: ChildProcessWithoutNullStreams[] = []

export class NodeEngine {
  private logEmitter: EventEmitter
  private showColors: boolean
  private logQueries: boolean
  private logLevel?: 'info' | 'warn'
  private env?: Record<string, string>
  private flags: string[]
  private port?: number
  private debug: boolean
  private child?: ChildProcessWithoutNullStreams
  private clientVersion?: string
  exitCode: number
  /**
   * exiting is used to tell the .on('exit') hook, if the exit came from our script.
   * As soon as the Prisma binary returns a correct return code (like 1 or 0), we don't need this anymore
   */
  exiting = false
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
  incorrectlyPinnedPlatform?: string
  datasources?: DatasourceOverwrite[]
  lastErrorLog?: RustLog
  lastError?: RustError
  startPromise?: Promise<any>
  engineStartDeferred?: Deferred
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
    ...args
  }: EngineConfig) {
    this.env = env
    this.cwd = this.resolveCwd(cwd)
    this.debug = args.debug || false
    this.datamodelPath = datamodelPath
    this.prismaPath = process.env.PRISMA_QUERY_ENGINE_BINARY || prismaPath
    this.generator = generator
    this.datasources = datasources
    this.logEmitter = new EventEmitter()
    this.showColors = showColors || false
    this.logLevel = logLevel
    this.logQueries = logQueries || false
    this.clientVersion = clientVersion
    this.flags = flags || []

    this.logEmitter.on('error', (log: RustLog) => {
      if (this.debug) {
        debugLib('engine:log')(log)
      }
      this.lastErrorLog = log
      if (log.fields.message === 'PANIC') {
        this.handlePanic(log)
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
        )
      }
    } else {
      this.getPlatform()
    }
    if (this.debug) {
      debugLib.enable('*')
    }
  }

  private resolveCwd(cwd?: string): string {
    if (cwd && fs.existsSync(cwd) && fs.lstatSync(cwd).isDirectory()) {
      return cwd
    }

    return process.cwd()
  }

  on(event: 'query' | 'info' | 'warn', listener: (log: RustLog) => any): void {
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
    this.child.kill()
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
      this.incorrectlyPinnedPlatform = this.platform
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
        eval('__dirname'),
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
      const pinnedStr = this.incorrectlyPinnedPlatform
        ? `\nYou incorrectly pinned it to ${chalk.redBright.bold(
            `${this.incorrectlyPinnedPlatform}`,
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

      throw new PrismaClientInitializationError(errorText)
    }

    if (this.incorrectlyPinnedPlatform) {
      console.error(`${chalk.yellow(
        'Warning:',
      )} You pinned the platform ${chalk.bold(
        this.incorrectlyPinnedPlatform,
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
      binaryTargets: fixPlatforms(
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

  private internalStart(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        this.port = await this.getFreePort()

        const env: any = {
          PRISMA_DML_PATH: this.datamodelPath,
          PORT: String(this.port),
          RUST_BACKTRACE: '1',
          RUST_LOG: 'info',
        }

        if (this.logQueries || this.logLevel === 'info') {
          env.RUST_LOG = 'info'
          if (this.logQueries) {
            env.LOG_QUERIES = 'true'
          }
        }

        if (this.logLevel === 'warn') {
          env.RUST_LOG = 'warn'
        }

        if (this.datasources) {
          env.OVERWRITE_DATASOURCES = this.printDatasources()
        }

        if (!process.env.NO_COLOR && this.showColors) {
          env.CLICOLOR_FORCE = '1'
        }

        debug(env)
        debug({ cwd: this.cwd })

        const prismaPath = await this.getPrismaPath()

        const flags = ['--enable-raw-queries', ...this.flags]
        debug({ flags })

        this.child = spawn(prismaPath, flags, {
          env: {
            ...this.env, // user-provided env vars
            ...process.env,
            ...env,
          },
          cwd: this.cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
        })

        children.push(this.child)

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
              this.engineStartDeferred.resolve()
              this.engineStartDeferred = undefined
            }
            if (typeof json.is_panic === 'undefined') {
              const log = convertLog(json)
              this.logEmitter.emit(log.level, log)
            } else {
              this.lastError = json
            }
          } catch (e) {
            // debug(e, data)
          }
        })

        this.child.on('exit', (code): void => {
          this.exitCode = code
          if (code !== 0 && this.engineStartDeferred) {
            const err = new PrismaClientInitializationError(this.stderrLogs)
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
          if (code === null && signal === 'SIGABRT' && this.child) {
            const error = new QueryEngineErrorWithLink(
              {
                platform: this.platform,
                title: `Panic in Query Engine with SIGABRT signal`,
                description: this.stderrLogs,
                version: this.clientVersion,
              },
              // this.platform,
              // `Panic in Query Engine with SIGABRT signal`,
              // this.stderrLogs,
            )
            this.logEmitter.emit('error', error)
          } else if (
            code === 255 &&
            signal === null &&
            this.lastErrorLog?.fields.message === 'PANIC'
          ) {
            const error = new QueryEngineErrorWithLink({
              platform: this.platform,
              title: `${this.lastErrorLog.fields.message}: ${this.lastErrorLog.fields.reason} in
${this.lastErrorLog.fields.file}:${this.lastErrorLog.fields.line}:${this.lastErrorLog.fields.column}`,
              version: this.clientVersion,
            })
            this.logEmitter.emit('error', error)
          }
        })

        if (this.lastError) {
          return reject(
            new PrismaClientInitializationError(getMessage(this.lastError)),
          )
        }

        if (this.lastErrorLog) {
          return reject(
            new PrismaClientInitializationError(getMessage(this.lastErrorLog)),
          )
        }

        try {
          await new Promise((resolve, reject) => {
            this.engineStartDeferred = { resolve, reject }
          })
        } catch (err) {
          this.child.kill()
          throw err
        }

        const url = `http://localhost:${this.port}`
        this.url = url
        // TODO: Re-enable
        // this.client = new Client(url)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  }

  fail = async (e, why): Promise<void> => {
    debug(e, why)
    await this.stop()
  }

  /**
   * If Prisma runs, stop it
   */
  async stop(): Promise<void> {
    await this.start()
    if (this.currentRequestPromise) {
      try {
        await this.currentRequestPromise
      } catch (e) {
        //
      }
    }
    if (this.child) {
      debug(`Stopping Prisma engine`)
      this.exiting = true
      // this.client.close()
      this.child.kill()
      delete this.child
    }
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

  /**
   * Make sure that our internal port is not conflicting with the prisma.yml's port
   * @param str config
   */
  protected trimPort(str: string): string {
    return str
      .split('\n')
      .filter((l) => !l.startsWith('port:'))
      .join('\n')
  }

  async request<T>(query: string): Promise<T> {
    await this.start()

    if (!this.child) {
      throw new PrismaClientUnknownRequestError(
        `Can't perform request, as the Engine has already been stopped`,
      )
    }

    const variables = {}
    const body = {
      query,
      variables,
    }

    const post = bent(this.url, 'POST', 'json', 200)
    this.currentRequestPromise = post('/', body)

    return this.currentRequestPromise
      .then((data) => {
        if (data.errors) {
          if (data.errors.length === 1) {
            throw this.graphQLToJSError(data.errors[0])
          }
          throw new Error(JSON.stringify(data.errors))
        }

        return data
      })
      .catch((error) => {
        debug({ error })
        if (this.currentRequestPromise.isCanceled && this.lastError) {
          // TODO: Replace these errors with known or unknown request errors
          if (this.lastError.is_panic) {
            throw new PrismaClientRustPanicError(getMessage(this.lastError))
          } else {
            throw new PrismaClientUnknownRequestError(
              getMessage(this.lastError),
            )
          }
        }
        if (this.currentRequestPromise.isCanceled && this.lastErrorLog) {
          throw new PrismaClientUnknownRequestError(
            getMessage(this.lastErrorLog),
          )
        }
        if (
          (error.code && error.code === 'ECONNRESET') ||
          error.code === 'ECONNREFUSED'
        ) {
          if (this.lastError) {
            throw new PrismaClientUnknownRequestError(
              getMessage(this.lastError),
            )
          }
          if (this.lastErrorLog) {
            throw new PrismaClientUnknownRequestError(
              getMessage(this.lastErrorLog),
            )
          }
          const logs = this.stderrLogs || this.stdoutLogs
          throw new PrismaClientUnknownRequestError(logs)
        }

        throw error
      })
  }

  async requestBatch<T>(queries: string[]): Promise<T> {
    await this.start()

    if (!this.child) {
      throw new PrismaClientUnknownRequestError(
        `Can't perform request, as the Engine has already been stopped`,
      )
    }

    const variables = {}
    const body = {
      batch: queries.map((query) => ({ query, variables })),
    }

    const post = bent(this.url, 'POST', 'json', 200)
    this.currentRequestPromise = post('/', body)

    return this.currentRequestPromise
      .then((data) => {
        if (Array.isArray(data)) {
          return data.map((result) => {
            if (result.errors) {
              return this.graphQLToJSError(result.errors[0])
            }
            return result
          })
        } else {
          if (data.errors && data.errors.length === 1) {
            throw new Error(data.errors[0].error)
          }
          throw new Error(JSON.stringify(data))
        }
      })
      .catch((error) => {
        debug({ error })
        if (this.currentRequestPromise.isCanceled && this.lastError) {
          // TODO: Replace these errors with known or unknown request errors
          if (this.lastError.is_panic) {
            throw new PrismaClientRustPanicError(getMessage(this.lastError))
          } else {
            throw new PrismaClientUnknownRequestError(
              getMessage(this.lastError),
            )
          }
        }
        if (this.currentRequestPromise.isCanceled && this.lastErrorLog) {
          throw new PrismaClientUnknownRequestError(
            getMessage(this.lastErrorLog),
          )
        }
        if (
          (error.code && error.code === 'ECONNRESET') ||
          error.code === 'ECONNREFUSED'
        ) {
          if (this.lastError) {
            throw new PrismaClientUnknownRequestError(
              getMessage(this.lastError),
            )
          }
          if (this.lastErrorLog) {
            throw new PrismaClientUnknownRequestError(
              getMessage(this.lastErrorLog),
            )
          }
          const logs = this.stderrLogs || this.stdoutLogs
          throw new PrismaClientUnknownRequestError(logs)
        }

        throw error
      })
  }

  private graphQLToJSError(
    error: RequestError,
  ): PrismaClientKnownRequestError | PrismaClientUnknownRequestError {
    if (error.user_facing_error.error_code) {
      return new PrismaClientKnownRequestError(
        error.user_facing_error.message,
        error.user_facing_error.error_code,
        error.user_facing_error.meta,
      )
    }

    return new PrismaClientUnknownRequestError(error.user_facing_error.message)
  }
}

function exitHandler(exit = false) {
  return () => {
    for (const child of children) {
      if (!child.killed) {
        child.kill()
      }
    }
    if (exit) {
      process.exit()
    }
  }
}

process.on('beforeExit', exitHandler())
process.on('exit', exitHandler())
process.on('SIGINT', exitHandler(true))
process.on('SIGUSR1', exitHandler(true))
process.on('SIGUSR2', exitHandler(true))
