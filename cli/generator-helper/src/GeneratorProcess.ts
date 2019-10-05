import { ChildProcessByStdio, spawn } from 'child_process'
import byline from './byline'
import { GeneratorManifest, GeneratorOptions, JsonRPC } from './types'

let globalMessageId = 1

export class GeneratorProcess {
  child: ChildProcessByStdio<any, any, any>
  listeners: { [key: string]: (result: any, err?: Error) => void } = {}
  private exitCode: number | null = null
  private stderrLogs: string = ''
  private initPromise?: Promise<void>
  private initialized: boolean = false
  constructor(private executablePath: string) {
    this.child = spawn(executablePath, {
      stdio: ['pipe', 'inherit', 'pipe'],
    })

    this.child.on('exit', code => {
      this.exitCode = code
    })
  }
  async init() {
    if (!this.initPromise) {
      this.initPromise = this.initSingleton()
    }
    return this.initPromise!
  }
  initSingleton(): Promise<void> {
    return new Promise((resolve, reject) => {
      byline(this.child.stderr).on('data', line => {
        const response = String(line)
        this.stderrLogs += response + '\n'
        let data
        try {
          data = JSON.parse(response)
        } catch (e) {
          if (!this.exitCode && this.initialized) {
            throw new Error(
              `Got invalid response from generator at ${
                this.executablePath
              }:\n${response}\n${e.stack || e.message}`,
            )
          }
        }
        if (data) {
          this.handleResponse(data)
        }
      })
      // wait 200ms for the binary to fail
      setTimeout(() => {
        if (this.exitCode && this.exitCode > 0) {
          reject(
            new Error(
              `Generator at ${this.executablePath} could not start:\n\n${this.stderrLogs}`,
            ),
          )
        } else {
          this.initialized = true
          resolve()
        }
      }, 200)
    })
  }
  private handleResponse(data: any) {
    if (data.jsonrpc && data.id) {
      if (typeof data.id !== 'number') {
        throw new Error(`message.id has to be a number. Found value ${data.id}`)
      }
      if (this.listeners[data.id]) {
        if (data.error) {
          this.listeners[data.id](null, data.error)
        } else {
          this.listeners[data.id](data.result)
        }
        delete this.listeners[data.id]
      }
    }
  }
  private registerListener(
    messageId: number,
    cb: (result: any, err?: Error) => void,
  ) {
    this.listeners[messageId] = cb
  }
  private sendMessage(message: JsonRPC.Request) {
    this.child.stdin.write(JSON.stringify(message) + '\n')
  }
  private getMessageId() {
    return globalMessageId++
  }
  stop() {
    if (!this.child.killed) {
      this.child.kill()
    }
  }
  getManifest(): Promise<GeneratorManifest | null> {
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
        params: {},
        id: messageId,
      })
    })
  }
  generate(options: GeneratorOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const messageId = this.getMessageId()

      this.registerListener(messageId, (result, error) => {
        if (error) {
          return reject(error)
        }
        if (result) {
          resolve()
        }
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
