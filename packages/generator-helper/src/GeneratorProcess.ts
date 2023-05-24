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

type ResultHandler<T = unknown> = {
  resolve: (value: T) => void
  reject: (error: Error) => void
}

export class GeneratorProcess {
  private child?: ChildProcessByStdio<Writable, null, Readable>
  private handlers: Record<string, ResultHandler> = {}
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
          this.pendingError = error
          this.rejectAllHandlers(error)
        }
      })

      // Set the error handler for stdin to prevent unhandled error events.
      // We handle write errors explicitly in `sendMessage` method.
      this.child.stdin.on('error', () => {})

      this.child.on('error', (error) => {
        debug(error)
        this.pendingError = error

        // Handle startup errors: reject the `init` promise.
        if ((error as NodeJS.ErrnoException).code === 'EACCES') {
          reject(
            new Error(
              `The executable at ${this.pathOrCommand} lacks the right permissions. Please use ${bold(
                `chmod +x ${this.pathOrCommand}`,
              )}`,
            ),
          )
        } else {
          reject(error)
        }

        // Reject any pending requests if the error event happened after spawning.
        this.rejectAllHandlers(error)
      })

      byline(this.child.stderr).on('data', (line: Buffer) => {
        const response = String(line)
        let data: JsonRPC.Response | undefined
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

  private rejectAllHandlers(error: Error) {
    for (const id of Object.keys(this.handlers)) {
      this.handlers[id].reject(error)
      delete this.handlers[id]
    }
  }

  private handleResponse(data: JsonRPC.Response): void {
    if (data.jsonrpc && data.id) {
      if (typeof data.id !== 'number') {
        throw new Error(`message.id has to be a number. Found value ${data.id}`)
      }
      if (this.handlers[data.id]) {
        if (isErrorResponse(data)) {
          const error = new GeneratorError(data.error.message, data.error.code, data.error.data)
          this.handlers[data.id].reject(error)
        } else {
          this.handlers[data.id].resolve(data.result)
        }
        delete this.handlers[data.id]
      }
    }
  }

  private sendMessage(message: JsonRPC.Request, callback: (error?: Error) => void): void {
    if (!this.child) {
      callback(new GeneratorError('Generator process has not started yet'))
      return
    }

    if (!this.child.stdin.writable) {
      callback(new GeneratorError('Cannot send data to the generator process, process already exited'))
      return
    }

    this.child.stdin.write(JSON.stringify(message) + '\n', (error) => {
      if (!error) {
        return callback()
      }

      if ((error as NodeJS.ErrnoException).code === 'EPIPE') {
        // Child process already terminated but we didn't know about it yet on Node.js side, so the `exit` event hasn't
        // been emitted yet, and the `child.stdin.writable` check also passed. We skip this error and let the `exit`
        // event handler reject active requests (including this one).
        return callback()
      }

      callback(error)
    })
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

        this.handlers[messageId] = {
          resolve: (result) => resolve(mapResult(result)),
          reject,
        }

        this.sendMessage(
          {
            jsonrpc: '2.0',
            method,
            params,
            id: messageId,
          },
          (error) => {
            if (error) reject(error)
          },
        )
      })
  }

  getManifest = this.rpcMethod<GeneratorConfig, GeneratorManifest | null>(
    'getManifest',
    (result) => (result as { manifest?: GeneratorManifest | null }).manifest ?? null,
  )

  generate = this.rpcMethod<GeneratorOptions, void>('generate')
}

function isErrorResponse(response: JsonRPC.Response): response is JsonRPC.ErrorResponse {
  return (response as JsonRPC.ErrorResponse).error !== undefined
}
