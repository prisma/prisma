import Debug from '@prisma/debug'
import type { ChildProcessByStdio } from 'child_process'
import { fork } from 'child_process'
import { spawn } from 'cross-spawn'
import { bold } from 'kleur/colors'

import byline from './byline'
import type { GeneratorConfig, GeneratorManifest, GeneratorOptions, JsonRPC } from './types'

const debug = Debug('prisma:GeneratorProcess')

let globalMessageId = 1

type GeneratorProcessOptions = {
  isNode?: boolean
  /**
   * Time to wait before we consider generator successfully started, ms
   */
  initWaitTime?: number
}

export class GeneratorError extends Error {
  public code: number
  public data?: any
  constructor(message: string, code: number, data?: any) {
    super(message)
    this.code = code
    this.data = data
    if (data?.stack) {
      this.stack = data.stack
    }
  }
}

export class GeneratorProcess {
  child?: ChildProcessByStdio<any, any, any>
  listeners: { [key: string]: (result: any, err?: Error) => void } = {}
  private exitCode: number | null = null
  private stderrLogs = ''
  private initPromise?: Promise<void>
  private isNode: boolean
  private initWaitTime: number
  private currentGenerateDeferred?: {
    resolve: (result: any) => void
    reject: (error: Error) => void
  }
  constructor(private executablePath: string, { isNode = false, initWaitTime = 200 }: GeneratorProcessOptions = {}) {
    this.isNode = isNode
    this.initWaitTime = initWaitTime
  }
  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initSingleton()
    }
    return this.initPromise
  }
  initSingleton(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.isNode) {
          this.child = fork(this.executablePath, [], {
            stdio: ['pipe', 'inherit', 'pipe', 'ipc'],
            env: {
              ...process.env,
              PRISMA_GENERATOR_INVOCATION: 'true',
            },
            execArgv: ['--max-old-space-size=8096'],
          })
        } else {
          this.child = spawn(this.executablePath, {
            stdio: ['pipe', 'inherit', 'pipe'],
            env: {
              ...process.env,
              PRISMA_GENERATOR_INVOCATION: 'true',
            },
          })
        }

        this.child.on('exit', (code) => {
          this.exitCode = code
          if (code && code > 0 && this.currentGenerateDeferred) {
            // print last 5 lines of stderr
            this.currentGenerateDeferred.reject(new Error(this.stderrLogs.split('\n').slice(-5).join('\n')))
          }
        })

        this.child.on('error', (err) => {
          if (err.message.includes('EACCES')) {
            reject(
              new Error(
                `The executable at ${this.executablePath} lacks the right chmod. Please use ${bold(
                  `chmod +x ${this.executablePath}`,
                )}`,
              ),
            )
          } else {
            reject(err)
          }
        })

        byline(this.child.stderr).on('data', (line) => {
          const response = String(line)
          this.stderrLogs += response + '\n'
          let data
          try {
            data = JSON.parse(response)
          } catch (e) {
            debug(response)
          }
          if (data) {
            this.handleResponse(data)
          }
        })
        // wait initWaitTime for the binary to fail
        // TODO: this a really flaky way to detect startup failure
        // In future, generator should explicitly send a notification when it finishes
        // initialization and we should wait until we got that notification. We can't introduce
        // it now since it would be a breaking change.
        setTimeout(() => {
          if (this.exitCode && this.exitCode > 0) {
            reject(new Error(`Generator at ${this.executablePath} could not start:\n\n${this.stderrLogs}`))
          } else {
            resolve()
          }
        }, this.initWaitTime)
      } catch (e) {
        reject(e)
      }
    })
  }
  private handleResponse(data: any): void {
    if (data.jsonrpc && data.id) {
      if (typeof data.id !== 'number') {
        throw new Error(`message.id has to be a number. Found value ${data.id}`)
      }
      if (this.listeners[data.id]) {
        if (data.error) {
          const error = new GeneratorError(data.error.message, data.error.code, data.error.data)
          this.listeners[data.id](null, error)
        } else {
          this.listeners[data.id](data.result)
        }
        delete this.listeners[data.id]
      }
    }
  }
  private registerListener(messageId: number, cb: (result: any, err?: Error) => void): void {
    this.listeners[messageId] = cb
  }
  private sendMessage(message: JsonRPC.Request): void {
    this.child!.stdin.write(JSON.stringify(message) + '\n')
  }
  private getMessageId(): number {
    return globalMessageId++
  }
  stop(): void {
    if (!this.child!.killed) {
      this.child!.kill()
    }
  }
  getManifest(config: GeneratorConfig): Promise<GeneratorManifest | null> {
    return new Promise((resolve, reject) => {
      const messageId = this.getMessageId()

      this.registerListener(messageId, (result, error) => {
        if (error) {
          return reject(error)
        }
        if (result.manifest) {
          resolve(result.manifest)
        } else {
          resolve(null)
        }
      })

      this.sendMessage({
        jsonrpc: '2.0',
        method: 'getManifest',
        params: config,
        id: messageId,
      })
    })
  }
  generate(options: GeneratorOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      const messageId = this.getMessageId()

      this.currentGenerateDeferred = { resolve, reject }

      this.registerListener(messageId, (result, error) => {
        if (error) {
          reject(error)
          this.currentGenerateDeferred = undefined
          return
        }
        resolve(result)
        this.currentGenerateDeferred = undefined
      })

      this.sendMessage({
        jsonrpc: '2.0',
        method: 'generate',
        params: options,
        id: messageId,
      })
    })
  }
}
