// @ts-check

import { spawn, ChildProcess } from 'child_process'
import Deferred from 'deferral'
import Debug from 'debug'
import fs from 'fs'

const debug = Debug('engine')

/**
 * Process class
 */
export default class Process {
  private readonly name: string
  private readonly args: string[] = []
  private _cwd = process.cwd()
  private _env: NodeJS.ProcessEnv = {}
  private _process?: ChildProcess = null
  private _running?: Deferred<number> = null
  private _stderr?: NodeJS.WritableStream = null
  private _stdout?: NodeJS.WritableStream = null
  private _stdio: string = ''

  /**
   * Create a process
   */
  constructor(name: string, ...args: string[]) {
    this.name = name
    this.args = args || []
    this.start = this.start.bind(this)
  }

  /**
   * Get the process ID if we have one
   */
  pid() {
    return this._process ? this._process.pid : 0
  }

  /**
   * Running?
   */
  async running(): Promise<boolean> {
    const code = await Promise.race([this._running.wait(), tick()])
    return typeof code !== 'number'
  }

  /**
   * Set the working directory
   */
  cwd(dir: string) {
    if (!fs.existsSync(dir)) {
      throw new Error(`Cwd ${dir} does not exist`)
    }
    debug('setting cwd', dir)
    this._cwd = dir
  }

  /**
   * Set the working directory
   */
  env(env: NodeJS.ProcessEnv) {
    debug('setting env', env)
    this._env = env || {}
  }

  /**
   * Set stderr
   */
  stderr(writer: NodeJS.WritableStream) {
    this._stderr = writer
  }

  /**
   * Set stdout
   */
  stdout(writer: NodeJS.WritableStream) {
    this._stdout = writer
  }

  /**
   * Start the process but don't wait for it to finish
   *
   * @todo right now we never will receive an error
   * in the future we should check to see if we had
   * an error immediately, using Promise.race([tick, deferred])
   */
  async start(): Promise<void> {
    // don't spawn another process if we already have one running
    if (this._running) {
      return
    }

    debug('starting: %s %s cwd: %s', this.name, this.args, this._cwd)
    debug('env:')
    debug(this._env)
    this._process = spawn(this.name, this.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this._cwd,
      env: this._env,
      detached: false,
    })

    this._process.stderr.on('data', chunk => (this._stdio += chunk.toString()))
    this._stderr && this._process.stderr.pipe(this._stderr)
    this._process.stdout.on('data', chunk => (this._stdio += chunk.toString()))
    this._stdout && this._process.stdout.pipe(this._stdout)

    this._running = new Deferred()
    this._process.once('error', e => {
      debug(e)
      this._running.reject(1)
    })
    this._process.once('exit', code => {
      // for some reason signals cause code to be null... wierd
      this._running.resolve(typeof code === 'number' ? code : 1)
    })

    const code = await Promise.race([tick(), this._running.wait()])
    // @todo buffer stderr and return that
    if (code) {
      throw this.error(code, this._stdio)
    }
  }

  /**
   * Wait until the process exits
   *
   * Wait will throw if the process
   * exits with a non-zero value
   */
  async wait(): Promise<void> {
    if (!this._running) {
      throw new Error('process is not running')
    }
    const code = await this._running.wait()
    this._running = null
    if (code) {
      throw this.error(code, this._stdio)
    }
  }

  /**
   * Run starts the process and waits for the result
   *
   * Wait will throw if the process
   * exits with a non-zero value
   */
  async run(): Promise<void> {
    await this.start()
    await this.wait()
    return
  }

  /**
   * Send a signal
   */
  async signal(signal: NodeJS.Signals) {
    this._process && this._process.kill(signal)
  }

  /**
   * Kill and wait for the process to exit
   */
  async kill(): Promise<void> {
    await this.signal('SIGTERM')
    await this.wait()
  }

  /**
   * Error
   */
  error(code: number, stdio?: string): Error {
    if (stdio) {
      return new Error(`process exited with a non-zero code: ${code}\n${stdio}`)
    }
    return new Error(`process exited with a non-zero code: ${code}`)
  }
}

/**
 * Tick function
 */
function tick(ms: number = 0): Promise<void> {
  return new Promise((resolve, _) => setTimeout(resolve, ms))
}
