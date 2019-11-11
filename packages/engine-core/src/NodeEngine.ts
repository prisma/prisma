import { Engine, PhotonError, PhotonQueryError } from './Engine'
import got from 'got'
import debugLib from 'debug'
import { getPlatform, Platform, mayBeCompatible } from '@prisma/get-platform'
import path from 'path'
import net from 'net'
import fs from 'fs'
import chalk from 'chalk'
import { GeneratorConfig } from '@prisma/generator-helper'
import { printGeneratorConfig } from './printGeneratorConfig'
import { fixPlatforms, plusX } from './util'
import { promisify } from 'util'
import EventEmitter from 'events'
import { convertLog, Log, RustLog } from './log'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import byline from './byline'

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
}

/**
 * Node.js based wrapper to run the Prisma binary
 */

const knownPlatforms: Platform[] = [
  'native',
  'darwin',
  'linux-glibc-libssl1.0.1',
  'linux-glibc-libssl1.0.2',
  'linux-glibc-libssl1.0.2-ubuntu1604',
  'linux-glibc-libssl1.1.0',
  'windows',
]

export class NodeEngine extends Engine {
  private logEmitter: EventEmitter
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
  lastError?: RustLog
  startPromise?: Promise<any>

  constructor({ cwd, datamodelPath, prismaPath, generator, datasources, ...args }: EngineConfig) {
    super()
    this.cwd = this.resolveCwd(cwd)
    this.debug = args.debug || false
    this.datamodelPath = datamodelPath
    this.prismaPath = prismaPath
    this.platform = process.env.PRISMA_QUERY_ENGINE_BINARY
    this.generator = generator
    this.datasources = datasources
    this.logEmitter = new EventEmitter()

    this.logEmitter.on('log', (log: RustLog) => {
      if (this.debug) {
        debugLib('engine:log')(log)
      }
      if (log.level === 'ERROR') {
        this.lastError = log
        if (log.fields.message === 'PANIC') {
          this.handlePanic(log)
        }
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

  on(event: 'log', listener: (log: Log) => any) {
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
          `Photon binary for current platform ${chalk.bold.greenBright(platform)} could not be found.${pinnedStr}
Photon looked in ${chalk.underline(alternativePath)} but couldn't find it.
Make sure to adjust the generator configuration in the ${chalk.bold('schema.prisma')} file${info}
Please run ${chalk.greenBright('prisma2 generate')} for your changes to take effect.
${chalk.gray(
  `Note, that by providing \`native\`, Photon automatically resolves \`${platform}\`.
Read more about deploying Photon: ${chalk.underline(
    'https://github.com/prisma/prisma2/blob/master/docs/core/generators/photonjs.md',
  )}`,
)}`,
        )
      } else {
        console.error(`${chalk.yellow(
          'warning',
        )} Photon could not resolve the needed binary for the current platform ${chalk.greenBright(platform)}.
Instead we found ${chalk.bold(
          alternativePath,
        )}, which we're trying for now. In case Photon runs, just ignore this message.`)
        plusX(alternativePath)
        return alternativePath
      }
    }

    if (this.incorrectlyPinnedPlatform) {
      console.log(`${chalk.yellow('Warning:')} You pinned the platform ${chalk.bold(
        this.incorrectlyPinnedPlatform,
      )}, but Photon detects ${chalk.bold(await this.getPlatform())}.
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
          LOG_QUERIES: 'true'
        }

        if (this.datasources) {
          env.OVERWRITE_DATASOURCES = this.printDatasources()
        }

        debug(env)
        debug({ cwd: this.cwd })

        const prismaPath = await this.getPrismaPath()

        this.child = spawn(prismaPath, [], {
          env: {
            ...process.env,
            ...env,
          },
          cwd: this.cwd,
          stdio: ['pipe', 'pipe', 'pipe'],
        })

        this.child.stderr.on('data', msg => {
          const data = String(msg)
          debug('stderr', data)
          if (data.includes('\u001b[1;94m-->\u001b[0m')) {
            this.stderrLogs += data
          }
        })

        byline(this.child.stdout).on('data', msg => {
          const data = String(msg)
          try {
            const json = JSON.parse(data)
            // debug(json)
            const log = convertLog(json)
            this.logEmitter.emit('log', log)
          } catch (e) {
            // debug(e, data)
          }
        })

        this.child.on('exit', code => {
          // const message = this.stderrLogs ? this.stderrLogs : this.stdoutLogs
          if (code === 126) {
            this.lastError = {
              timestamp: new Date(),
              target: 'exit',
              level: 'ERROR',
              fields: {
                message: `Couldn't start query engine as it's not executable on this operating system.
You very likely have the wrong "binaryTarget" defined in the schema.prisma file.`,
              },
            }
          } else {
            this.lastError = {
              target: 'exit',
              timestamp: new Date(),
              level: 'ERROR',
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
          return reject(new PhotonError(this.lastError))
        }

        try {
          await this.engineReady()
        } catch (err) {
          await this.child.kill()
          throw err
        }

        const url = `http://localhost:${this.port}`
        this.url = url
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
        throw new PhotonError(this.lastError)
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

  async getDmmf(): Promise<any> {
    const result = await got.get(this.url + '/dmmf', {
      json: true,
    })
    return result.body.data
  }

  async request<T>(query: string, typeName?: string): Promise<T> {
    await this.start()

    if (!this.child) {
      throw new Error(`Engine has already been stopped`)
    }
    this.currentRequestPromise = got.post(this.url, {
      json: true,
      headers: {
        'Content-Type': 'application/json',
      },
      body: { query, variables: {} },
    })

    return this.currentRequestPromise
      .then(({ body }) => {
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
        if (this.currentRequestPromise.isCanceled && this.lastError) {
          throw new PhotonError(this.lastError)
        }
        if ((error.code && error.code === 'ECONNRESET') || error.code === 'ECONNREFUSED') {
          if (this.lastError) {
            throw new PhotonError(this.lastError)
          }
          const logs = this.stderrLogs || this.stdoutLogs
          throw new Error(logs)
        }
        if (!(error instanceof PhotonQueryError)) {
          return this.handleErrors({ errors: error, query })
        } else {
          throw error
        }
      })
  }

  private serializeErrors(errors: any) {
    // make the happy case beautiful
    if (Array.isArray(errors) && errors.length === 1 && errors[0].error && typeof errors[0].error === 'string') {
      return errors[0].error
    }

    return JSON.stringify(errors, null, 2)
  }

  handleErrors({ errors, query }: { errors?: any; query: string }) {
    const stringified = errors ? this.serializeErrors(errors) : null
    const message = stringified.length > 0 ? stringified : `Error in photon.\$\{rootField || 'query'}`
    const isPanicked = this.stderrLogs.includes('panicked') || this.stdoutLogs.includes('panicked') // TODO better handling
    if (isPanicked) {
      this.stop()
    }
    throw new PhotonQueryError(message)
  }
}
