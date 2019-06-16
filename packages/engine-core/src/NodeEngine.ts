import { Engine, PhotonError } from './Engine'
import fetch from 'cross-fetch'
import Process from './process'
import Deferred from 'deferral'
import through from 'through2'
import debugLib from 'debug'
import * as path from 'path'
import * as net from 'net'

const debug = debugLib('engine')

interface EngineConfig {
  cwd?: string
  datamodel: string
  debug?: boolean
  prismaPath?: string
  fetcher?: (query: string) => Promise<{ data?: any; error?: any }>
}

/**
 * Global process list so node.js doesn't get all uptight
 * about "Possible EventEmitter memory leak detected. 11 SIGTERM listeners added"
 */
const processes: Process[] = []

/**
 * Pass the signals through
 */
process.once('SIGTERM', sig => processes.map(proc => proc.signal(sig)))
process.once('SIGINT', sig => processes.map(proc => proc.signal(sig)))

/**
 * Node.js based wrapper to run the Prisma binary
 */
export class NodeEngine extends Engine {
  port?: number
  debug: boolean
  child?: Process
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
  starting?: Deferred<void>
  stderrLogs: string = ''
  stdoutLogs: string = ''
  currentRequestPromise?: Promise<any>
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
  }

  /**
   * Starts the engine, returns the url that it runs on
   */
  async start(): Promise<void> {
    if (this.starting) {
      return this.starting.wait()
    }
    this.starting = new Deferred()
    this.child = new Process(this.prismaPath)

    // set the working directory
    this.child.cwd(this.cwd)

    this.port = await this.getFreePort()

    // add the environment
    this.child.env({
      ...process.env,
      PRISMA_DML: this.datamodel,
      PORT: String(this.port),
      RUST_BACKTRACE: '1',
    })

    // proxy stdout and stderr
    this.child.stderr(debugStream(debugLib('engine:stderr')))
    this.child.stdout(debugStream(debugLib('engine:stdout')))

    // start the process
    await this.child.start()

    // add process to processes list
    processes.push(this.child)

    // wait for the engine to be ready
    await this.engineReady()

    const url = `http://localhost:${this.port}`
    this.url = url

    // resolve starting to unlock other stakeholders
    this.starting.resolve()
    return
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
      // cleanup processes array
      const i = processes.indexOf(this.child)
      if (~i) processes.splice(i, 1)
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
      }
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
    await this.start()

    if (!this.child) {
      throw new Error(`Engine has already been stopped`)
    }
    this.currentRequestPromise = fetch(this.url, {
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
    return this.currentRequestPromise
  }

  handleErrors({ errors, query }: { errors?: any; query: string }) {
    const stringified = errors ? JSON.stringify(errors, null, 2) : null
    const message = stringified.length > 0 ? stringified : `Error in photon.\$\{rootField || 'query'}`
    const isPanicked = this.stderrLogs.includes('panicked')
    if (isPanicked) {
      this.stop()
    }
    throw new PhotonError(message, query, errors, this.stderrLogs + this.stdoutLogs, isPanicked)
  }
}

// simple utility function to turn debug into a writable stream
function debugStream(debugFn: any): NodeJS.WritableStream {
  return through(function(chunk, _enc, fn) {
    debugFn(chunk.toString())
    this.push(chunk)
    fn()
  })
}
