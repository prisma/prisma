import Debug from '@prisma/debug'
import type { ChildProcessByStdio } from 'child_process'
import { fork } from 'child_process'
import { spawn } from 'cross-spawn'
import { bold } from 'kleur/colors'
import { Readable, Writable } from 'stream'

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
  name = 'GeneratorError'

  constructor(message: string, public code?: number, public data?: any) {
    super(message)
    if (data?.stack) {
      this.stack = data.stack
    }
  }
}

export class GeneratorProcess {
  private child?: ChildProcessByStdio<Writable, null, Readable>
  private listeners: { [key: string]: (result: any, err?: Error) => void } = {}
  private initPromise?: Promise<void>
  private isNode: boolean
  private errorLogs = ''
  private pendingError: Error | undefined

  constructor(private pathOrCommand: string, { isNode = false }: GeneratorProcessOptions = {}) {
    this.isNode = isNode
  }

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initSingleton()
    }
    return this.initPromise
  }

  initSingleton(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isNode) {
        this.child = fork(this.pathOrCommand, [], {
          stdio: ['pipe', 'inherit', 'pipe', 'ipc'],
          env: {
            ...process.env,
            PRISMA_GENERATOR_INVOCATION: 'true',
          },
          execArgv: ['--max-old-space-size=8096'],
        }) as ChildProcessByStdio<Writable, null, Readable>
      } else {
        this.child = spawn(this.pathOrCommand, {
          stdio: ['pipe', 'inherit', 'pipe'],
          env: {
            ...process.env,
            PRISMA_GENERATOR_INVOCATION: 'true',
          },
          shell: true,
        })
      }

      this.child.on('exit', (code, signal) => {
        debug(`child exited with code ${code} on signal ${signal}`)
        if (code) {
          const error = new GeneratorError(
            `Generator ${JSON.stringify(this.pathOrCommand)} failed:\n\n${this.errorLogs}`,
          )
          for (const listener of Object.values(this.listeners)) {
            listener(null, error)
          }
          this.pendingError = error
        }
      })

      this.child.on('error', (err) => {
        this.pendingError = err
        if (err.message.includes('EACCES')) {
          debug(err)
          reject(
            new Error(
              `The executable at ${this.pathOrCommand} lacks the right permissions. Please use ${bold(
                `chmod +x ${this.pathOrCommand}`,
              )}`,
            ),
          )
        } else {
          reject(err)
        }
      })

      byline(this.child.stderr).on('data', (line: Buffer) => {
        const response = String(line)
        let data: string | undefined
        try {
          data = JSON.parse(response)
        } catch (e) {
          this.errorLogs += response + '\n'
          debug(response)
        }
        if (data) {
          this.handleResponse(data)
        }
      })

      this.child.on('spawn', resolve)
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
    if (!this.child) {
      throw new GeneratorError('Generator process has not started yet')
    }
    if (!this.child.stdin.writable) {
      throw new GeneratorError('Cannot send data to the generator process, process already exited')
    }

    try {
      this.child.stdin.write(JSON.stringify(message) + '\n')
    } catch (err) {
      console.error(err.code)
    }
  }

  private getMessageId(): number {
    return globalMessageId++
  }

  stop(): void {
    if (!this.child?.killed) {
      this.child?.kill()
    }
  }

  private rpcMethod<T, U>(method: string, mapResult: (x: unknown) => U = (x) => x as U): (arg: T) => Promise<U> {
    return (params: T): Promise<U> =>
      new Promise((resolve, reject) => {
        if (this.pendingError) {
          reject(this.pendingError)
          return
        }

        const messageId = this.getMessageId()

        this.registerListener(messageId, (result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(mapResult(result))
          }
        })

        this.sendMessage({
          jsonrpc: '2.0',
          method,
          params,
          id: messageId,
        })
      })
  }

  getManifest = this.rpcMethod<GeneratorConfig, GeneratorManifest | null>(
    'getManifest',
    (result) => (result as { manifest?: GeneratorManifest | null }).manifest ?? null,
  )

  generate = this.rpcMethod<GeneratorOptions, void>('generate')
}
