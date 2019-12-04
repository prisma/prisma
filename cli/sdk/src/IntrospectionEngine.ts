import chalk from 'chalk'
import { ChildProcess, spawn } from 'child_process'
import debugLib from 'debug'
import byline from './utils/byline'
const debugRpc = debugLib('IntrospectionEngine:rpc')
const debugStderr = debugLib('IntrospectionEngine:stderr')
const debugStdin = debugLib('IntrospectionEngine:stdin')
import { getPlatform } from '@prisma/get-platform'
import fs from 'fs'
import { now } from './utils/now'
import path from 'path'

export interface IntrospectionEngineOptions {
  binaryPath?: string
  debug?: boolean
  cwd?: string
}

export interface RPCPayload {
  id: number
  jsonrpc: string
  method: string
  params: any
}

export class EngineError extends Error {
  public code: number
  constructor(message: string, code: number) {
    super(message)
    this.code = code
  }
}

export class IntrospectionPanic extends Error {
  public request: any
  public rustStack: string
  constructor(message: string, rustStack: string, request: any) {
    super(message)
    this.rustStack = rustStack
    this.request = request
  }
}

type IntrospectionArgs = {
  url: string
}

let messageId = 1

/* tslint:disable */
export class IntrospectionEngine {
  private binaryPath?: string
  private debug: boolean
  private cwd: string
  private child?: ChildProcess
  private listeners: { [key: string]: (result: any, err?: any) => any } = {}
  private messages: string[] = []
  private lastRequest?: any
  private lastError?: any
  private initPromise?: Promise<void>
  constructor(
    { binaryPath, debug, cwd }: IntrospectionEngineOptions = {
      binaryPath: process.env.PRISMA_INTROSPECTION_ENGINE_BINARY, // ncc go home
      debug: false,
      cwd: process.cwd(),
    },
  ) {
    this.binaryPath = binaryPath
    if (debug) {
      debugLib.enable('IntrospectionEngine*')
    }
    this.debug = Boolean(debug)
    this.cwd = cwd || process.cwd()
  }
  public stop() {
    this.child!.kill()
  }
  private rejectAll(err: any) {
    Object.entries(this.listeners).map(([id, listener]) => {
      listener(null, err)
      delete this.listeners[id]
    })
  }
  private registerCallback(
    id: number,
    callback: (result: any, err?: Error) => any,
  ) {
    this.listeners[id] = callback
  }
  public introspect(url: string): Promise<any> {
    return this.runCommand(this.getRPCPayload('introspect', { url }))
  }
  public listDatabases(url: string): Promise<any> {
    return this.runCommand(this.getRPCPayload('listDatabases', { url }))
  }
  public getDatabaseMetadata(url: string): Promise<any> {
    return this.runCommand(this.getRPCPayload('getDatabaseMetadata', { url }))
  }
  private handleResponse(response: any) {
    let result
    try {
      result = JSON.parse(response)
    } catch (e) {
      console.error(
        `Could not parse introspection engine response: ${response.slice(
          0,
          200,
        )}`,
      )
    }
    if (result) {
      if (result.backtrace) {
        // if there is a backtrace on the result, it's probably an error
        console.log(result)
      }
      if (!result.id) {
        console.error(
          `Response ${JSON.stringify(
            result,
          )} doesn't have an id and I can't handle that (yet)`,
        )
      }
      if (!this.listeners[result.id]) {
        console.error(`Got result for unknown id ${result.id}`)
      }
      if (this.listeners[result.id]) {
        this.listeners[result.id](result)
        delete this.listeners[result.id]
      }
    }
  }
  private init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.internalInit()
    }

    return this.initPromise!
  }
  private async getBinaryPath() {
    if (this.binaryPath) {
      return this.binaryPath
    }

    const platform = await getPlatform()
    const extension = platform === 'windows' ? '.exe' : ''

    this.binaryPath = path.join(
      eval(`require('path').join(__dirname, '../')`),
      `introspection-engine-${platform}${extension}`,
    )
    if (!fs.existsSync(this.binaryPath)) {
      throw new Error(
        `Expected introspection engine at ${this.binaryPath} does not exist.`,
      )
    }
    return this.binaryPath
  }
  private internalInit(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const { PWD, ...env } = process.env
        this.child = spawn(await this.getBinaryPath(), {
          stdio: ['pipe', 'pipe', this.debug ? process.stderr : 'pipe'],
          env: {
            ...env,
            RUST_LOG: 'info',
            RUST_BACKTRACE: '1',
            PWD: this.cwd,
          },
        })

        this.child.on('error', err => {
          console.error('[introspection-engine] error: %s', err)
          reject(err)
          this.rejectAll(err)
        })

        this.child.on('exit', (code, signal) => {
          const messages = this.messages.join('\n')
          let err: any
          if (code !== 0 || messages.includes('panicked at')) {
            let errorMessage =
              chalk.red.bold('Error in introspection engine: ') + messages
            if (messages.includes('\u001b[1;94m-->\u001b[0m')) {
              errorMessage = `${chalk.red.bold('Schema parsing ')}` + messages
            } else if (this.lastError && this.lastError.msg === 'PANIC') {
              errorMessage = serializePanic(this.lastError)
              err = new IntrospectionPanic(
                errorMessage,
                messages,
                this.lastRequest,
              )
            } else if (messages.includes('panicked at')) {
              err = new IntrospectionPanic(
                errorMessage,
                messages,
                this.lastRequest,
              )
            }
            err = err || new Error(errorMessage)
            this.rejectAll(err)
            reject(err)
          }
        })

        this.child.stdin!.on('error', err => {
          debugStdin(err)
        })

        byline(this.child.stderr).on('data', data => {
          const msg = String(data)
          this.messages.push(msg)
          debugStderr(msg)
          try {
            const json = JSON.parse(msg)
            if (json.backtrace) {
              console.log('setting lastError')
              this.lastError = json
            }
            if (json.level === 'ERRO') {
              this.lastError = json
            }
          } catch (e) {
            //
          }
        })

        byline(this.child.stdout).on('data', line => {
          this.handleResponse(String(line))
        })

        setImmediate(() => {
          resolve()
        })
      } catch (e) {
        reject(e)
      }
    })
  }
  private async runCommand(request: RPCPayload): Promise<any> {
    await this.init()
    return new Promise((resolve, reject) => {
      this.registerCallback(request.id, (response, err) => {
        if (err) {
          return reject(err)
        }
        if (typeof response.result === 'string') {
          resolve(response.result)
        } else {
          if (response.error) {
            if (
              response.error.data &&
              response.error.data.error &&
              response.error.data.code
            ) {
              reject(
                new EngineError(
                  response.error.data.error,
                  response.error.data.code,
                ),
              )
            } else {
              const text = this.persistError(request, this.messages.join('\n'))
              reject(
                new Error(
                  `${chalk.redBright(
                    'Error in RPC',
                  )}\n Request: ${JSON.stringify(
                    request,
                    null,
                    2,
                  )}\nResponse: ${JSON.stringify(response, null, 2)}\n${
                    response.error.message
                  }\n\n${text}\n`,
                ),
              )
            }
          } else {
            reject(
              new Error(
                `Got invalid RPC response without .result property: ${JSON.stringify(
                  response,
                )}`,
              ),
            )
          }
        }
      })
      debugRpc('SENDING RPC CALL', JSON.stringify(request))
      this.child!.stdin!.write(JSON.stringify(request) + '\n')
      this.lastRequest = request
    })
  }
  private persistError(request: any, message: string): string {
    const filename = `failed-${request.method}-${now()}.md`
    const file = `# Failed ${request.method} at ${new Date().toISOString()}
## RPC One-Liner
\`\`\`json
${JSON.stringify(request)}
\`\`\`

## RPC Input Readable
\`\`\`json
${JSON.stringify(request, null, 2)}
\`\`\`

## Stack Trace
\`\`\`bash
${message}
\`\`\`
`
    // fs.writeFileSync(
    //   filename,
    //   file,
    // )
    return `Wrote ${chalk.bold(filename)} with debugging information.
Please put that file into a gist and post it in Slack.
1. ${chalk.greenBright(`cat ${filename} | pbcopy`)}
2. Create a gist ${chalk.greenBright.underline(`https://gist.github.com/new`)}`
  }
  private getRPCPayload(method: string, params: any): RPCPayload {
    return {
      id: messageId++,
      jsonrpc: '2.0',
      method,
      params: [
        {
          ...params,
        },
      ],
    }
  }
}

function serializePanic(log) {
  return `${chalk.red.bold(
    'Error in introspection engine.\nReason: ',
  )}${chalk.red(
    `${log.reason} in ${chalk.underline(
      `${log.file}:${log.line}:${log.column}`,
    )}`,
  )}

Please create an issue in the ${chalk.bold('prisma2')} repo with the error 🙏:
${chalk.underline('https://github.com/prisma/prisma2/issues/new')}\n`
}
