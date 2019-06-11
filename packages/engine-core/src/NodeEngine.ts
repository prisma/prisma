import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as net from 'net'
import debugLib from 'debug'
import fetch from 'cross-fetch'
import { Engine, PhotonError } from './Engine'

const debug = debugLib('engine')

interface EngineConfig {
  cwd?: string
  datamodel: string
  debug?: boolean
  prismaPath?: string
  fetcher?: (query: string) => Promise<{ data?: any; error?: any }>
}

/**
 * Node.js based wrapper to run the Prisma binary
 */
export class NodeEngine extends Engine {
  port?: number
  debug: boolean
  child?: ChildProcess
  /**
   * exiting is used to tell the .on('exit') hook, if the exit came from our script.
   * As soon as the Prisma binary returns a correct return code (like 1 or 0), we don't need this anymore
   */
  exiting: boolean = false
  managementApiEnabled: boolean = false
  datamodelJson?: string
  cwd: string
  datamodel: string
  prismaPath: string
  url: string
  startPromise: Promise<void>
  stderrLogs: string = ''
  stdoutLogs: string = ''
  static defaultPrismaPath = path.join(__dirname, '../prisma')
  constructor({ cwd, datamodel, prismaPath, ...args }: EngineConfig) {
    super()
    this.cwd = cwd || process.cwd()
    this.debug = args.debug || false
    this.datamodel = datamodel
    this.prismaPath = prismaPath || NodeEngine.defaultPrismaPath
    if (this.debug) {
      debugLib.enable('engine')
    }
    this.startPromise = this.start()
  }

  /**
   * Starts the engine, returns the url that it runs on
   */
  start(): Promise<void> {
    if (this.startPromise) {
      return this.startPromise
    }
    return new Promise(async (resolve, reject) => {
      this.port = await this.getFreePort()
      debug(`Starting binary at ${this.prismaPath}`)
      const env = {
        ...process.env,
        PRISMA_DML: this.datamodel,
        PORT: String(this.port),
        RUST_BACKTRACE: '1',
      }
      debug(env)
      this.child = spawn(this.prismaPath, [], {
        env,
        detached: false,
        cwd: this.cwd,
      })
      this.child.stderr.on('data', d => {
        const str = d.toString()
        this.stdoutLogs += str
        debug(str)
      })
      this.child.stdout.on('data', d => {
        const data = d.toString()
        this.stderrLogs += data
        debug(data)
      })
      this.child.on('error', e => {
        this.stderrLogs += e.toString()
        debug(e)
        reject(e)
      })
      this.child.on('exit', (code, e) => {
        if (code !== 0 && !this.exiting) {
          console.error(`Engine path: ${this.prismaPath}`)
          const logs = this.stderrLogs || this.stdoutLogs
          throw new PhotonError(`Error in query engine: ` + logs, undefined, undefined, logs)
        }
      })

      // Make sure we kill Rust when this process is being killed
      process.on('SIGTERM', e => this.fail(e, 'SIGTERM'))
      process.on('SIGINT', e => this.fail(e, 'SIGINT'))
      // process.once('uncaughtException', e => this.fail(e, 'uncaughtException'))
      // process.once('unhandledRejection', e => this.fail(e, 'unhandledRejection'))

      await this.engineReady()
      const url = `http://localhost:${this.port}`
      this.url = url
      resolve()
    })
  }

  fail = async (e, why) => {
    debug(e, why)
    await this.stop()
  }

  /**
   * If Prisma runs, stop it
   */
  stop = async () => {
    await this.startPromise
    if (this.child) {
      debug(`Stopping Prisma engine`)
      this.exiting = true
      this.child.kill()
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
      try {
        await new Promise(r => setTimeout(r, 50)) // TODO: Try out lower intervals here, but we also don't want to spam it too much.
        const response = await fetch(`http://localhost:${this.port}/status`, {
          timeout: 5000, // not official but node-fetch supports it
        } as any)
        if (response.ok) {
          debug(`Ready after try number ${tries}`)
          return
        }
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
    return fetch(this.url + '/dmmf').then(res => res.json())
  }

  async request<T>(query: string, typeName?: string): Promise<T> {
    if (!this.url) {
      await this.startPromise // allows lazily connecting the client to Rust and Rust to the Datasource
    }
    return fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: {}, operationName: '' }),
    })
      .then(response => {
        if (!response.ok) {
          return response.text().then(body => {
            const { status, statusText } = response
            this.handleErrors({
              errors: {
                status,
                statusText,
                body,
              },
              query,
            })
          })
        } else {
          return response.json().then(result => {
            const { data } = result
            const errors = result.error || result.errors
            if (errors) {
              return this.handleErrors({
                errors,
                query,
              })
            }
            return data
          })
        }
      })
      .catch(errors => {
        if (!(errors instanceof PhotonError)) {
          return this.handleErrors({ errors, query })
        } else {
          throw errors
        }
      })
  }
  handleErrors({ errors, query }: { errors?: any; query: string }) {
    const stringified = errors ? JSON.stringify(errors, null, 2) : null
    const message = stringified.length > 0 ? stringified : `Error in photon.\$\{rootField || 'query'}`
    const isPanicked = this.stderrLogs.includes('panicked')
    if (isPanicked) {
      this.stop()
    }
    throw new PhotonError(message, query, errors, this.stderrLogs, isPanicked)
  }
}
