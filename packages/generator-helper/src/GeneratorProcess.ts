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
  child?: ChildProcessByStdio<Writable, null, Readable>
  listeners: { [key: string]: (result: any, err?: Error) => void } = {}
  private initPromise?: Promise<void>
  private isNode: boolean
  private errorLogs = ''

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

      this.child.on('exit', (code) => {
        debug(`child exited with code ${code}`)
        if (code) {
          const error = new GeneratorError(
            `Generator ${JSON.stringify(this.pathOrCommand)} failed:\n\n${this.errorLogs}`,
          )
          for (const listener of Object.values(this.listeners)) {
            listener(null, error)
          }
        }
      })

      this.child.on('error', (err) => {
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

      this.registerListener(messageId, (result, error) => {
        if (error) {
          reject(error)
          return
        }
        resolve(result)
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
