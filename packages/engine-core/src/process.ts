// @ts-check

import { spawn, ChildProcess } from 'child_process'
import Deferred from 'deferral'
import through from 'through2'
import Debug from 'debug'

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
  running(): boolean {
    return !!this._running
  }

  /**
   * Set the working directory
   */
  cwd(dir: string) {
    this._cwd = dir
  }

  /**
   * Set the working directory
   */
  env(env: NodeJS.ProcessEnv) {
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

    debug('starting: %s %s cwd: %s env: %j', this.name, this.args, this._cwd, this._env)
    this._process = spawn(this.name, this.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this._cwd,
      env: this._env,
    })

    this._stderr && this._process.stderr.pipe(through(filter)).pipe(this._stderr)
    this._stdout && this._process.stdout.pipe(this._stdout)

    this._running = new Deferred()
    this._process.once('error', err => this._running.reject(err))
    this._process.once('exit', code => this._running.resolve(code))

    const code = await Promise.race([tick(), this._running.wait()])
    // @todo buffer stderr and return that
    if (code) {
      throw new Error(`process exited with a non-zero code: ${code}`)
    }
  }

  /**
   * Wait until the process exits or errors out
   */
  async wait(): Promise<void> {
    if (!this._running) {
      throw new Error('process is not running')
    }
    const code = await this._running.wait()
    this._running = null
    if (code) {
      throw new Error(`process exited with a non-zero code: ${code}`)
    }
  }

  /**
   * Run starts the process and waits for the result
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
}
module.exports = Process

/**
 * Filter out lines from a stream
 * Pass everything through for now
 */
function filter(chunk, _enc, fn) {
  this.push(chunk)
  return fn()
}

/**
 * Tick function
 */
function tick(ms: number = 0): Promise<void> {
  return new Promise((resolve, _) => setTimeout(resolve, ms))
}
