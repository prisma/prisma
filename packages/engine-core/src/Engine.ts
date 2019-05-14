import { promisify } from 'util'
import { spawn, ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as net from 'net'
import debugLib from 'debug'
import fetch from 'node-fetch'
import { getInternalDatamodelJson } from './getInternalDatamodelJson'

const debug = debugLib('engine')

interface EngineConfig {
  prismaYmlPath: string
  prismaConfig?: string
  datamodel: string
  datamodelJson?: string
  debug?: boolean
  schemaInferrerPath?: string
  prismaPath?: string
}

const readFile = promisify(fs.readFile)

/**
 * Node.js based wrapper to run the Prisma binary
 */
export class Engine {
  prismaYmlPath: string
  prismaConfig?: string
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
  schemaInferrerPath: string
  prismaPath: string
  static defaultSchemaInferrerPath = path.join(__dirname, '../schema-inferrer-bin')
  static defaultPrismaPath = path.join(__dirname, '../prisma')
  constructor({
    prismaConfig,
    debug,
    datamodelJson,
    prismaYmlPath,
    datamodel,
    schemaInferrerPath,
    prismaPath,
  }: EngineConfig) {
    this.prismaYmlPath = prismaYmlPath
    this.prismaConfig = prismaConfig
    this.cwd = path.dirname(this.prismaYmlPath)
    this.debug = debug || false
    this.datamodelJson = datamodelJson
    this.datamodel = datamodel
    this.schemaInferrerPath = schemaInferrerPath || Engine.defaultSchemaInferrerPath
    this.prismaPath = prismaPath || Engine.defaultPrismaPath
    if (debug) {
      debugLib.enable('engine')
    }
  }

  /**
   * Resolve the prisma.yml
   */
  async getPrismaYml(ymlPath: string) {
    return await readFile(ymlPath, 'utf-8')
  }

  /**
   * Starts the engine, returns the url that it runs on
   */
  // TODO: Maybe use p-retry to be more fault resistent against used ports
  async start(): Promise<string> {
    this.port = await this.getFreePort()
    this.prismaConfig = this.prismaConfig || (await this.getPrismaYml(this.prismaYmlPath))
    const PRISMA_CONFIG = this.generatePrismaConfig()
    const schemaEnv: any = {}
    if (!this.datamodelJson) {
      this.datamodelJson = await getInternalDatamodelJson(this.datamodel)
    }
    debug(`Starting binary at ${this.prismaPath}`)
    const env = {
      PRISMA_CONFIG,
      PRISMA_SDL: this.datamodel,
      SERVER_ROOT: process.cwd(),
      PRISMA_INTERNAL_DATA_MODEL_JSON: this.datamodelJson,
      ...schemaEnv,
    }
    debug(env)
    this.child = spawn(this.prismaPath, [], {
      env,
      detached: false,
      // stdio: '',
      cwd: this.cwd,
    })
    this.child.stderr.on('data', d => {
      debug(d.toString())
    })
    this.child.stdout.on('data', d => {
      debug(d.toString())
    })
    this.child.on('error', e => {
      debug(e)
      throw e
    })
    this.child.on('exit', (code, e) => {
      if (code !== 0 && !this.exiting) {
        const debugString = this.debug
          ? ''
          : 'Please enable "debug": true in the Engine constructor to get more insights.'
        throw new Error(`Child exited with code ${code}${debugString}${e}`)
      }
    })

    // Make sure we kill Rust when this process is being killed
    process.once('SIGTERM', this.stop)
    process.once('SIGINT', this.stop)
    process.once('uncaughtException', this.stop)

    await this.engineReady()
    const url = `http://localhost:${this.port}`
    return url
  }

  /**
   * If Prisma runs, stop it
   */
  stop = () => {
    if (this.child) {
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
   * Replace the port in the Prisma Config
   */
  protected generatePrismaConfig() {
    return `port: ${this.port}\n${this.trimPort(this.prismaConfig)}`
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
        const response = await fetch(`http://localhost:${this.port}/datamodel`)
        await new Promise(r => setTimeout(r, 50)) // TODO: Try out lower intervals here, but we also don't want to spam it too much.
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
}
