import chalk from 'chalk'
import { ChildProcess, spawn } from 'child_process'
import Debug from '@prisma/debug'
import { EngineArgs, EngineResults } from './types'
import byline from './utils/byline'
const debugRpc = Debug('MigrateEngine:rpc')
const debugStderr = Debug('MigrateEngine:stderr')
const debugStdin = Debug('MigrateEngine:stdin')
import fs from 'fs'
import { now } from './utils/now'
import { RustPanic, ErrorArea, resolveBinary } from '@prisma/sdk'

export interface MigrateEngineOptions {
  projectDir: string
  schemaPath: string
  binaryPath?: string
  debug?: boolean
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

let messageId = 1

/* tslint:disable */
export class MigrateEngine {
  private binaryPath?: string
  private projectDir: string
  private debug: boolean
  private child?: ChildProcess
  private schemaPath: string
  private listeners: { [key: string]: (result: any, err?: any) => any } = {}
  private messages: string[] = []
  private lastRequest?: any
  private lastError?: any
  private initPromise?: Promise<void>
  constructor({ projectDir, debug = false, schemaPath }: MigrateEngineOptions) {
    this.projectDir = projectDir
    this.schemaPath = schemaPath
    if (debug) {
      Debug.enable('MigrateEngine*')
    }
    this.debug = debug
  }
  public stop(): void {
    this.child!.kill()
  }
  /* eslint-disable @typescript-eslint/no-unsafe-return */
  public schemaPush(
    args: EngineArgs.SchemaPush,
  ): Promise<EngineResults.SchemaPush> {
    return this.runCommand(this.getRPCPayload('schemaPush', args))
  }
  public applyMigration(
    args: EngineArgs.ApplyMigration,
  ): Promise<EngineResults.ApplyMigration> {
    return this.runCommand(this.getRPCPayload('applyMigration', args))
  }
  public unapplyMigration(
    args: EngineArgs.UnapplyMigration,
  ): Promise<EngineResults.UnapplyMigration> {
    return this.runCommand(this.getRPCPayload('unapplyMigration', args))
  }
  public calculateDatamodel(
    args: EngineArgs.CalculateDatamodel,
  ): Promise<EngineResults.CalculateDatamodel> {
    return this.runCommand(this.getRPCPayload('calculateDatamodel', args))
  }
  public calculateDatabaseSteps(
    args: EngineArgs.CalculateDatabaseSteps,
  ): Promise<EngineResults.ApplyMigration> {
    return this.runCommand(this.getRPCPayload('calculateDatabaseSteps', args))
  }
  public inferMigrationSteps(
    args: EngineArgs.InferMigrationSteps,
  ): Promise<EngineResults.InferMigrationSteps> {
    return this.runCommand(this.getRPCPayload('inferMigrationSteps', args))
  }
  // Helper function, oftentimes we just want the applied migrations
  public async listAppliedMigrations(
    args: EngineArgs.ListMigrations,
  ): Promise<EngineResults.ListMigrations> {
    const migrations = await this.runCommand(
      this.getRPCPayload('listMigrations', args),
    )
    return migrations.filter((m) => m.status === 'MigrationSuccess')
  }
  public migrationProgess(
    args: EngineArgs.MigrationProgress,
  ): Promise<EngineResults.MigrationProgress> {
    return this.runCommand(this.getRPCPayload('migrationProgress', args))
  }
  public debugPanic(): Promise<any> {
    return this.runCommand(this.getRPCPayload('debugPanic', undefined))
  }
  /* eslint-enable @typescript-eslint/no-unsafe-return */
  private rejectAll(err: any): void {
    Object.entries(this.listeners).map(([id, listener]) => {
      listener(null, err)
      delete this.listeners[id]
    })
  }
  private registerCallback(
    id: number,
    callback: (result: any, err?: Error) => any,
  ): void {
    this.listeners[id] = callback
  }
  private handleResponse(response: any): void {
    let result
    try {
      result = JSON.parse(response)
    } catch (e) {
      console.error(
        `Could not parse migration engine response: ${response.slice(0, 200)}`,
      )
    }
    if (result) {
      // If the error happens before the JSON-RPC sever starts, the error doesn't have an id
      if (!result.id) {
        if (result.is_panic) {
          throw new Error(`Response ${JSON.stringify(result.message)}`)
        } else if (result.message) {
          console.error(`Response ${JSON.stringify(result.message)}`)
        } else {
          console.error(`Response ${JSON.stringify(result)}`)
        }
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

    return this.initPromise
  }
  private internalInit(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        const { PWD, ...rest } = process.env
        const binaryPath = await resolveBinary('migration-engine')
        debugRpc('starting migration engine with binary: ' + binaryPath)
        this.child = spawn(binaryPath, ['-d', this.schemaPath], {
          cwd: this.projectDir,
          stdio: ['pipe', 'pipe', this.debug ? process.stderr : 'pipe'],
          env: {
            ...rest,
            SERVER_ROOT: this.projectDir,
            RUST_LOG: 'info',
            RUST_BACKTRACE: '1',
          },
        })

        this.child.on('error', (err) => {
          console.error('[migration-engine] error: %s', err)
          reject(err)
          this.rejectAll(err)
        })

        this.child.on('exit', (code, signal) => {
          const messages = this.messages.join('\n')
          let err: RustPanic | Error | undefined
          if (code !== 0 || messages.includes('panicking')) {
            let errorMessage =
              chalk.red.bold('Error in migration engine: ') + messages
            if (this.lastError && code === 255) {
              errorMessage = serializePanic(this.lastError)
              err = new RustPanic(
                errorMessage,
                this.lastError.message,
                this.lastRequest,
                ErrorArea.LIFT_CLI,
                this.schemaPath,
              )
            } else if (messages.includes('panicked at') || code === 255) {
              err = new RustPanic(
                errorMessage,
                messages,
                this.lastRequest,
                ErrorArea.LIFT_CLI,
                this.schemaPath,
              )
            }
            err = err || new Error(errorMessage)
            this.rejectAll(err)
            reject(err)
          }
        })

        this.child.stdin!.on('error', (err) => {
          debugStdin(err)
        })

        byline(this.child.stderr).on('data', (data) => {
          const msg = String(data)
          this.messages.push(msg)
          debugStderr(msg)
          try {
            const json = JSON.parse(msg)
            if (json.backtrace) {
              this.lastError = json
            }
            if (json.level === 'ERRO') {
              this.lastError = json
            }
          } catch (e) {
            //
          }
        })

        byline(this.child.stdout).on('data', (line) => {
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
    if (process.env.FORCE_PANIC_MIGRATION_ENGINE) {
      request = this.getRPCPayload('debugPanic', undefined)
    }
    await this.init()
    if (this.child?.killed) {
      throw new Error(
        `Can't execute ${JSON.stringify(
          request,
        )} because migration engine already exited.`,
      )
    }
    return new Promise((resolve, reject) => {
      this.registerCallback(request.id, (response, err) => {
        if (err) {
          return reject(err)
        }
        if (response.result) {
          resolve(response.result)
        } else {
          if (response.error) {
            debugRpc(response)
            if (response.error.data?.is_panic) {
              // if (response.error.data && response.error.data.message) {
              const message =
                response.error.data?.error?.message ?? response.error.message
              reject(
                // Handle error and displays the interactive dialog to send panic error
                new RustPanic(
                  message,
                  response.error.data.message,
                  this.lastRequest,
                  ErrorArea.LIFT_CLI,
                  this.schemaPath,
                ),
              )
            } else if (response.error.data?.message) {
              // Print known error code & message from engine
              // See known errors at https://github.com/prisma/specs/tree/master/errors#prisma-sdk
              let message = `${chalk.redBright(response.error.data.message)}\n`
              if (response.error.data?.error_code) {
                message =
                  chalk.redBright(`${response.error.data.error_code}\n\n`) +
                  message
                reject(new EngineError(message, response.error.data.error_code))
              } else {
                reject(new Error(message))
              }
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
      if (this.child!.stdin!.destroyed) {
        throw new Error(
          `Can't execute ${JSON.stringify(
            request,
          )} because migration engine is destroyed.`,
        )
      }
      debugRpc('SENDING RPC CALL', JSON.stringify(request))
      this.child!.stdin!.write(JSON.stringify(request) + '\n')
      this.lastRequest = request
    })
  }
  private persistError(request: any, message: string): string {
    const filename = `failed-${request.method}-${now()}.md`
    fs.writeFileSync(
      filename,
      `# Failed ${request.method} at ${new Date().toISOString()}
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
`,
    )
    return `Wrote ${chalk.bold(filename)} with debugging information.
Please put that file into a gist and post it in Slack.
1. ${chalk.greenBright(`cat ${filename} | pbcopy`)}
2. Create a gist ${chalk.greenBright.underline(`https://gist.github.com/new`)}`
    // }
  }
  private getRPCPayload(method: string, params: any): RPCPayload {
    return {
      id: messageId++,
      jsonrpc: '2.0',
      method,
      params: {
        projectInfo: '',
        ...params,
      },
    }
  }
}

function serializePanic(log): string {
  return `${chalk.red.bold('Error in migration engine.\nReason: ')}${chalk.red(
    `${log.message}`,
  )}

Please create an issue in the ${chalk.bold('migrate')} repo with
your \`schema.prisma\` and the prisma command you tried to use 🙏:
${chalk.underline('https://github.com/prisma/migrate/issues/new')}\n`
}
