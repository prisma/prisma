import { Engine, PrismaClientError, PrismaClientQueryError, QueryEngineError } from './Engine'
import debugLib from 'debug'
import { getPlatform, Platform, mayBeCompatible } from '@prisma/get-platform'
import path from 'path'
import net from 'net'
import fs from 'fs'
import chalk from 'chalk'
import { GeneratorConfig } from '@prisma/generator-helper'
import { printGeneratorConfig } from './printGeneratorConfig'
import { fixPlatforms, plusX } from './util'
import { promisify, inspect } from 'util'
import EventEmitter from 'events'
import { convertLog, Log, RustLog, RustError } from './log'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import byline from './byline'
import { Client } from './client'
import got from 'got'

const debug = debugLib('engine')
const exists = promisify(fs.exists)

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
  'windows',
]

export class NodeEngine extends Engine {
  private logEmitter: EventEmitter
  private showColors: boolean
  private logQueries: boolean
  private logLevel?: 'info' | 'warn'
  private env?: Record<string, string>
  private client?: Client
  port?: number
  debug: boolean
  child?: ChildProcessWithoutNullStreams
  /**
   * exiting is used to tell the .on('exit') hook, if the exit came from our script.
   * As soon as the Prisma binary returns a correct return code (like 1 or 0), we don't need this anymore
   */
  exiting: boolean = false
  managementApiEnabled: boolean = false
  datamodelJson?: string
  cwd: string
  datamodelPath: string
  prismaPath?: string
  url: string
  ready: boolean = false
  stderrLogs: string = ''
  stdoutLogs: string = ''
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
    ...args
  }: EngineConfig) {
    super()
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
      if (!knownPlatforms.includes(this.platform as Platform) && !fs.existsSync(this.platform)) {
        throw new Error(
          `Unknown ${chalk.red('PRISMA_QUERY_ENGINE_BINARY')} ${chalk.redBright.bold(
            this.platform,
          )}. Possible binaryTargets: ${chalk.greenBright(
            knownPlatforms.join(', '),
          )} or a path to the query engine binary.
You may have to run ${chalk.greenBright('prisma2 generate')} for your changes to take effect.`,
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

  on(event: 'query' | 'info' | 'warn', listener: (log: RustLog) => any) {
    this.logEmitter.on(event, listener)
  }

  async getPlatform() {
    if (this.platformPromise) {
      return this.platformPromise
    }

    this.platformPromise = getPlatform()

    return this.platformPromise
  }

  private getQueryEnginePath(platform: string, prefix: string = __dirname): string {
    let queryEnginePath = path.join(prefix, `query-engine-${platform}`)

    if (platform === 'windows') {
      queryEnginePath = `${queryEnginePath}.exe`
    }

    return queryEnginePath
  }

  private handlePanic(log: RustLog) {
    this.child.kill()
    if (this.currentRequestPromise) {
      ;(this.currentRequestPromise as any).cancel()
    }
  }

  private async resolvePrismaPath() {
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
      return this.getQueryEnginePath(this.platform, path.resolve(__dirname, `..`))
    } else {
      return this.getQueryEnginePath(this.platform)
    }
  }

  // If we couldn't find the correct binary path, let's look for an alternative
  // This is interesting for libssl 1.0.1 vs libssl 1.0.2 cases

  private async resolveAlternativeBinaryPath(platform: Platform): Promise<string | null> {
    const compatiblePlatforms = knownPlatforms.slice(1).filter(p => mayBeCompatible(p, platform))
    const binariesExist = await Promise.all(
      compatiblePlatforms.map(async platform => {
        const filePath = this.getQueryEnginePath(platform)
        return {
          exists: await exists(filePath),
          platform,
          filePath,
        }
      }),
    )

    const firstExistingPlatform = binariesExist.find(b => b.exists)
    if (firstExistingPlatform) {
      return firstExistingPlatform.filePath
    }

    return null
  }

  // get prisma path
  private async getPrismaPath() {
    const prismaPath = await this.resolvePrismaPath()
    const platform = await this.getPlatform()
    if (!(await exists(prismaPath))) {
      let info = '.'
      if (this.generator) {
        const fixedGenerator = {
          ...this.generator,
          binaryTargets: fixPlatforms(this.generator.binaryTargets as Platform[], this.platform!),
        }
        info = `:\n${chalk.greenBright(printGeneratorConfig(fixedGenerator))}`
      }

      const pinnedStr = this.incorrectlyPinnedPlatform
        ? `\nYou incorrectly pinned it to ${chalk.redBright.bold(`${this.incorrectlyPinnedPlatform}`)}\n`
        : ''

      const alternativePath = await this.resolveAlternativeBinaryPath(platform)

      if (!alternativePath) {
        throw new Error(
          `Query engine binary for current platform ${chalk.bold.greenBright(platform)} could not be found.${pinnedStr}
Prisma Client looked in ${chalk.underline(prismaPath)} but couldn't find it.
Make sure to adjust the generator configuration in the ${chalk.bold('schema.prisma')} file${info}
Please run ${chalk.greenBright('prisma2 generate')} for your changes to take effect.
${chalk.gray(
  `Note, that by providing \`native\`, Prisma Client automatically resolves \`${platform}\`.
Read more about deploying Prisma Client: ${chalk.underline(
    'https://github.com/prisma/prisma2/blob/master/docs/core/generators/prisma-client-js.md',
  )}`,
)}`,
        )
      } else {
        console.error(`${chalk.yellow(
          'warning',
        )} Prisma Client could not resolve the needed binary for the current platform ${chalk.greenBright(platform)}.
Instead we found ${chalk.bold(
          alternativePath,
        )}, which we're trying for now. In case Prisma Client runs, just ignore this message.`)
        plusX(alternativePath)
        return alternativePath
      }
    }

    if (this.incorrectlyPinnedPlatform) {
      console.log(`${chalk.yellow('Warning:')} You pinned the platform ${chalk.bold(
        this.incorrectlyPinnedPlatform,
      )}, but Prisma Client detects ${chalk.bold(await this.getPlatform())}.
This means you should very likely pin the platform ${chalk.greenBright(await this.getPlatform())} instead.
${chalk.dim("In case we're mistaken, please report this to us 🙏.")}`)
    }

    plusX(prismaPath)

    return prismaPath
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
    if (!this.startPromise) {
      this.startPromise = this.internalStart()
    }
    return this.startPromise
  }

  private internalStart(): Promise<void> {
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

        this.child = spawn(prismaPath, ['--enable_raw_queries'], {
          env: {
            ...this.env, // user-provided env vars
            ...process.env,
            ...env,
          },
          cwd: this.cwd,
          stdio: ['pipe', 'pipe', 'pipe'],
        })

        byline(this.child.stderr).on('data', msg => {
          const data = String(msg)
          debug('stderr', data)
          try {
            const json = JSON.parse(data)
            if (typeof json.is_panic !== 'undefined') {
              debug(json)
              this.lastError = json
            }
          } catch (e) {
            // debug(e, data)
          }
        })

        byline(this.child.stdout).on('data', msg => {
          const data = String(msg)
          try {
            const json = JSON.parse(data)
            debug('stdout', json)
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

        this.child.on('exit', code => {
          if (!code) {
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
                message: (this.stderrLogs || '') + (this.stdoutLogs || '') + code,
              },
            }
          }
        })

        this.child.on('error', err => {
          reject(err)
        })

        if (this.lastError) {
          return reject(new PrismaClientError(this.lastError))
        }

        if (this.lastErrorLog) {
          return reject(new PrismaClientError(this.lastErrorLog))
        }

        try {
          await this.engineReady()
        } catch (err) {
          await this.child.kill()
          throw err
        }

        const url = `http://localhost:${this.port}`
        this.url = url
        this.client = new Client(url)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  }

  fail = async (e, why) => {
    debug(e, why)
    await this.stop()
  }

  /**
   * If Prisma runs, stop it
   */
  async stop() {
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
      await this.child.kill()
      delete this.child
    }
  }

  /**
   * Use the port 0 trick to get a new port
   */
  protected getFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer(s => s.end(''))
      server.unref()
      server.on('error', reject)
      server.listen(0, () => {
        const address = server.address()
        const port = typeof address === 'string' ? parseInt(address.split(':').slice(-1)[0], 10) : address.port
        server.close(e => {
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
  protected trimPort(str: string) {
    return str
      .split('\n')
      .filter(l => !l.startsWith('port:'))
      .join('\n')
  }

  // TODO: Replace it with a simple tcp connection
  protected async engineReady() {
    let tries = 0
    while (true) {
      if (!this.child) {
        return
      } else if (this.child.killed) {
        throw new Error('Engine has died')
      }
      await new Promise(r => setTimeout(r, 50))
      if (this.lastError) {
        throw new PrismaClientError(this.lastError)
      }
      if (this.lastErrorLog) {
        throw new PrismaClientError(this.lastErrorLog)
      }
      try {
        await got(`http://localhost:${this.port}/status`, {
          timeout: 5000, // not official but node-fetch supports it
        })
        debug(`Ready after try number ${tries}`)
        this.ready = true
        return
      } catch (e) {
        debug(e.message)
        if (tries >= 100) {
          throw e
        }
      } finally {
        tries++
      }
    }
  }

  async request<T>(query: string, collectTimestamps: any): Promise<T> {
    collectTimestamps && collectTimestamps.record('Pre-engine_request_start')
    await this.start()
    collectTimestamps && collectTimestamps.record('Post-engine_request_start')

    collectTimestamps && collectTimestamps.record('Pre-engine_request_http')

    if (!this.child) {
      throw new Error(`Can't perform request, as the Engine has already been stopped`)
    }

    collectTimestamps && collectTimestamps.record('Pre-engine_request_http_instance')

    this.currentRequestPromise = this.client.request(query)

    collectTimestamps && collectTimestamps.record('Post-engine_request_http_instance')

    return this.currentRequestPromise
      .then(data => {
        const { body, headers } = data
        collectTimestamps && collectTimestamps.record('Post-engine_request_http')

        if (collectTimestamps && headers['x-elapsed']) {
          // Convert from microseconds to miliseconds
          const timeElapsedInRust = parseInt(headers['x-elapsed']) / 1e3
          collectTimestamps.addResults({ engine_request_http_got_rust: timeElapsedInRust })
        }

        const errors = body.error || body.errors
        if (errors) {
          return this.handleErrors({
            errors,
            query,
          })
        }
        return body.data
      })
      .catch(error => {
        collectTimestamps && collectTimestamps.record('Post-engine_request_http')
        debug({ error })
        if (this.currentRequestPromise.isCanceled && this.lastError) {
          throw new PrismaClientError(this.lastError)
        }
        if (this.currentRequestPromise.isCanceled && this.lastErrorLog) {
          throw new PrismaClientError(this.lastErrorLog)
        }
        if ((error.code && error.code === 'ECONNRESET') || error.code === 'ECONNREFUSED') {
          if (this.lastError) {
            throw new PrismaClientError(this.lastError)
          }
          if (this.lastErrorLog) {
            throw new PrismaClientError(this.lastErrorLog)
          }
          const logs = this.stderrLogs || this.stdoutLogs
          throw new Error(logs)
        }
        if (!(error instanceof PrismaClientQueryError)) {
          return this.handleErrors({ errors: error, query })
        } else {
          throw error
        }
      })
  }

  private serializeErrors(errors: any) {
    if (typeof errors === 'object' && errors.message) {
      return errors.message
    }
    // make the happy case beautiful
    if (Array.isArray(errors) && errors.length === 1 && errors[0].error && typeof errors[0].error === 'string') {
      return errors[0].error
    }

    return JSON.stringify(errors, null, 2)
  }

  handleErrors({ errors }: { errors?: QueryEngineError[]; query: string }) {
    if (errors.length === 1 && errors[0].user_facing_error) {
      throw new PrismaClientQueryError(errors[0])
    }

    const stringified = errors ? this.serializeErrors(errors) : null
    const message = stringified.length > 0 ? stringified : `Error in prisma.\$\{rootField || 'query'}` // TODO
    const isPanicked = this.stderrLogs.includes('panicked') || this.stdoutLogs.includes('panicked') // TODO better handling
    if (isPanicked) {
      this.stop()
    }

    throw new PrismaClientError(message)
  }
}
