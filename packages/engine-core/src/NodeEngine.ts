import { Engine, PhotonError } from './Engine'
import got from 'got'
import debugLib from 'debug'
import { getPlatform, Platform } from '@prisma/get-platform'
import * as path from 'path'
import * as net from 'net'
import fs from 'fs'
import chalk from 'chalk'
import { GeneratorConfig } from '@prisma/cli'
import { printGeneratorConfig } from './printGeneratorConfig'
import { fixPlatforms, plusX } from './util'
import { promisify } from 'util'
import EventEmitter from 'events'
import { convertLog, Log } from './log'
import execa = require('execa')

const debug = debugLib('engine')
const exists = promisify(fs.exists)

export interface DatasourceOverwrite {
  name: string
  url: string
}

export interface EngineConfig {
  cwd?: string
  datamodel: string
  debug?: boolean
  prismaPath?: string
  platform?: Platform
  fetcher?: (query: string) => Promise<{ data?: any; error?: any }>
  generator?: GeneratorConfig
  datasources?: DatasourceOverwrite[]
}

/**
 * Node.js based wrapper to run the Prisma binary
 */

const knownPlatforms = [
  'native',
  'darwin',
  'linux-glibc-libssl1.0.1',
  'linux-glibc-libssl1.0.2',
  'linux-glibc-libssl1.1.0',
  'linux-musl-libssl1.1.0',
]
export class NodeEngine extends Engine {
  private logEmitter: EventEmitter
  port?: number
  debug: boolean
  child?: execa.ExecaChildProcess
  /**
   * exiting is used to tell the .on('exit') hook, if the exit came from our script.
   * As soon as the Prisma binary returns a correct return code (like 1 or 0), we don't need this anymore
   */
  exiting: boolean = false
  managementApiEnabled: boolean = false
  datamodelJson?: string
  cwd: string
  datamodel: string
  prismaPath?: string
  url: string
  ready: boolean = false
  stderrLogs: string = ''
  stdoutLogs: string = ''
  currentRequestPromise?: Promise<any>
  cwdPromise: Promise<string>
  platformPromise: Promise<Platform>
  platform?: Platform
  generator?: GeneratorConfig
  incorrectlyPinnedPlatform?: string
  datasources?: DatasourceOverwrite[]
  lastError?: Log
  startPromise?: Promise<any>

  constructor({ cwd, datamodel, prismaPath, platform, generator, datasources, ...args }: EngineConfig) {
    super()
    this.cwd = cwd
    this.debug = args.debug || false
    this.datamodel = datamodel
    this.prismaPath = prismaPath
    this.platform = platform
    this.generator = generator
    this.datasources = datasources
    this.logEmitter = new EventEmitter()

    this.logEmitter.on('log', log => {
      if (log.level === 'error') {
        this.lastError = log
      }
    })

    if (platform) {
      if (!knownPlatforms.includes(platform)) {
        throw new Error(
          `Unknown ${chalk.red('pinnedPlatform')} ${chalk.redBright.bold(
            platform,
          )}. Possible platforms: ${chalk.greenBright(knownPlatforms.join(', '))}.
You may have to run ${chalk.greenBright('prisma2 generate')} for your changes to take effect.`,
        )
      }
    } else {
      this.getPlatform()
    }
    if (this.debug) {
      debugLib.enable('engine')
    }
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

  private async resolvePrismaPath() {
    if (this.prismaPath) {
      return this.prismaPath
    }

    const platform = await this.getPlatform()
    if (this.platform && this.platform !== platform) {
      this.incorrectlyPinnedPlatform = this.platform
    }

    this.platform = this.platform || platform

    const fileName = eval(`path.basename(__filename)`)
    if (fileName === 'NodeEngine.js') {
      return path.join(__dirname, `../query-engine-${this.platform}`)
    } else {
      return path.join(__dirname, `query-engine-${this.platform}`)
    }
  }

  // If we couldn't find the correct binary path, let's look for an alternative
  // This is interesting for libssl 1.0.1 vs libssl 1.0.2 cases

  private async resolveAlternativeBinaryPath(): Promise<string | null> {
    const binariesExist = await Promise.all(
      knownPlatforms.slice(1).map(async platform => {
        const filePath = path.join(__dirname, `query-engine-${platform}`)
        return {
          exists: await exists(filePath),
          platform,
          filePath,
        }
      }),
    )

    debug({ binariesExist })

    const firstExistingPlatform = binariesExist.find(b => b.exists)
    if (firstExistingPlatform) {
      return firstExistingPlatform.filePath
    }

    return null
  }

  private async getPrismaPath() {
    const prismaPath = await this.resolvePrismaPath()
    debug({ prismaPath })
    if (!(await exists(prismaPath))) {
      let info = '.'
      if (this.generator) {
        const fixedGenerator = {
          ...this.generator,
          platforms: fixPlatforms(this.generator.platforms as Platform[], this.platform!),
        }
        if (this.generator.pinnedPlatform && this.incorrectlyPinnedPlatform) {
          fixedGenerator.pinnedPlatform = await this.getPlatform()
        }
        info = `:\n${chalk.greenBright(printGeneratorConfig(fixedGenerator))}`
      }

      const pinnedStr = this.incorrectlyPinnedPlatform
        ? `\nYou incorrectly pinned it to ${chalk.redBright.bold(`${this.incorrectlyPinnedPlatform}`)}\n`
        : ''

      const alternativePath = await this.resolveAlternativeBinaryPath()

      if (!alternativePath) {
        throw new Error(
          `Photon binary for current platform ${chalk.bold.greenBright(
            await this.getPlatform(),
          )} could not be found.${pinnedStr}
  Make sure to adjust the generator configuration in the ${chalk.bold('schema.prisma')} file${info}
  Please run ${chalk.greenBright('prisma2 generate')} for your changes to take effect.
  ${chalk.gray(
    `Note, that by providing \`native\`, Photon automatically resolves \`${await this.getPlatform()}\`.
  Read more about deploying Photon: ${chalk.underline(
    'https://github.com/prisma/prisma2/blob/master/docs/core/generators/photonjs.md',
  )}`,
  )}`,
        )
      } else {
        console.error(`${chalk.yellow(
          'warning',
        )} Photon could not resolve the needed binary for the current platform ${chalk.greenBright(
          await this.getPlatform(),
        )}.
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
          PRISMA_DML: this.datamodel,
          PORT: String(this.port),
          RUST_BACKTRACE: '1',
        }

        if (this.datasources) {
          env.OVERWRITE_DATASOURCES = this.printDatasources()
        }

        debugLib('engine')(env)

        this.child = execa(await this.getPrismaPath(), {
          env: {
            ...process.env,
            ...env,
          },
        })

        this.child.stderr.on('data', data => {
          const message = String(data)
          this.stderrLogs += message
          debugLib('engine:stderr')(message)
        })

        this.child.stdout.on('data', data => {
          const message = String(data)
          debugLib('engine:stdout')(message)
          try {
            const json = JSON.parse(message)
            const log = convertLog(json)
            this.logEmitter.emit('log', log)
          } catch (e) {
            //
          }
        })

        this.child.on('error', err => {
          reject(err)
        })

        // wait for the engine to be ready
        // TODO: we should fix this since it's not obvious what's happening
        // here. We wait for the engine to try and connect, if it fails
        // we'll try to kill the child. Often times the child is already
        // dead and will also throw. We prefer that error over engineReady's
        // error, so we take that first. If there wasn't an error, we'll use
        // engineReady's error.

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
      await this.child.cancel()
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
    this.currentRequestPromise = got
      .post(this.url, {
        json: true,
        headers: {
          'Content-Type': 'application/json',
        },
        body: { query, variables: {}, operationName: '' },
      })
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
      .catch(errors => {
        if (errors.code && errors.code === 'ECONNRESET') {
          const logs = this.stderrLogs || this.stdoutLogs
          throw new Error(logs)
        }
        if (!(errors instanceof PhotonError)) {
          return this.handleErrors({ errors, query })
        } else {
          throw errors
        }
      })
    return this.currentRequestPromise
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
    throw new Error(message)
  }
}
