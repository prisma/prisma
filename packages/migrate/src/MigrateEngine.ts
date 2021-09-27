import Debug from '@prisma/debug'
import {
  BinaryType,
  ErrorArea,
  resolveBinary,
  RustPanic,
  MigrateEngineLogLine,
  MigrateEngineExitCode,
} from '@prisma/sdk'
import chalk from 'chalk'
import { ChildProcess, spawn } from 'child_process'
import { EngineArgs, EngineResults } from './types'
import byline from './utils/byline'
const debugRpc = Debug('prisma:migrateEngine:rpc')
const debugStderr = Debug('prisma:migrateEngine:stderr')
const debugStdin = Debug('prisma:migrateEngine:stdin')

export interface MigrateEngineOptions {
  projectDir: string
  schemaPath: string
  debug?: boolean
  enabledPreviewFeatures?: string[]
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
  private projectDir: string
  private debug: boolean
  private child?: ChildProcess
  private schemaPath: string
  private listeners: { [key: string]: (result: any, err?: any) => any } = {}
  /**  _All_ the logs from the engine process. */
  private messages: string[] = []
  private lastRequest?: any
  /** The fields of the last engine log event with an `ERROR` level. */
  private lastError: MigrateEngineLogLine['fields'] | null = null
  private initPromise?: Promise<void>
  private enabledPreviewFeatures?: string[]
  constructor({
    projectDir,
    debug = false,
    schemaPath,
    enabledPreviewFeatures,
  }: MigrateEngineOptions) {
    this.projectDir = projectDir
    this.schemaPath = schemaPath
    if (debug) {
      Debug.enable('MigrateEngine*')
    }
    this.debug = debug
    this.enabledPreviewFeatures = enabledPreviewFeatures
  }
  public stop(): void {
    this.child!.kill()
  }
  /* eslint-disable @typescript-eslint/no-unsafe-return */

  // Runs dev diagnostic
  public devDiagnostic(
    args: EngineArgs.DevDiagnosticInput,
  ): Promise<EngineResults.DevDiagnosticOutput> {
    return this.runCommand(this.getRPCPayload('devDiagnostic', args))
  }
  // List migrations in migration directory.
  public listMigrationDirectories(
    args: EngineArgs.ListMigrationDirectoriesInput,
  ): Promise<EngineResults.ListMigrationDirectoriesOutput> {
    return this.runCommand(this.getRPCPayload('listMigrationDirectories', args))
  }
  // Mark the specified migration as applied in the migrations table. There are two possible cases:
  // - The migration is already in the table, but in a failed state. In this case, we will mark it as rolled back, then create a new entry.
  // - The migration is not in the table. We will create a new entry in the migrations table. The `started_at` and `finished_at` will be the same.
  // - If it is already applied, we return a user-facing error.
  public markMigrationApplied(
    args: EngineArgs.MarkMigrationAppliedInput,
  ): Promise<void> {
    return this.runCommand(this.getRPCPayload('markMigrationApplied', args))
  }
  // Mark an existing failed migration as rolled back in the migrations table. It will still be there, but ignored for all purposes except as audit trail.
  public markMigrationRolledBack(
    args: EngineArgs.MarkMigrationRolledBackInput,
  ): Promise<void> {
    return this.runCommand(this.getRPCPayload('markMigrationRolledBack', args))
  }
  public diagnoseMigrationHistory(
    args: EngineArgs.DiagnoseMigrationHistoryInput,
  ): Promise<EngineResults.DiagnoseMigrationHistoryOutput> {
    return this.runCommand(this.getRPCPayload('diagnoseMigrationHistory', args))
  }
  public planMigration(
    args: EngineArgs.PlanMigrationInput,
  ): Promise<EngineResults.PlanMigrationOutput> {
    return this.runCommand(this.getRPCPayload('planMigration', args))
  }
  public evaluateDataLoss(
    args: EngineArgs.EvaluateDataLossInput,
  ): Promise<EngineResults.EvaluateDataLossOutput> {
    return this.runCommand(this.getRPCPayload('evaluateDataLoss', args))
  }
  public createMigration(
    args: EngineArgs.CreateMigrationInput,
  ): Promise<EngineResults.CreateMigrationOutput> {
    return this.runCommand(this.getRPCPayload('createMigration', args))
  }
  public applyMigrations(
    args: EngineArgs.ApplyMigrationsInput,
  ): Promise<EngineResults.ApplyMigrationsOutput> {
    return this.runCommand(this.getRPCPayload('applyMigrations', args))
  }
  public reset(): Promise<void> {
    return this.runCommand(this.getRPCPayload('reset', undefined))
  }
  public getDatabaseVersion(): Promise<string> {
    return this.runCommand(this.getRPCPayload('getDatabaseVersion', undefined))
  }
  public schemaPush(
    args: EngineArgs.SchemaPush,
  ): Promise<EngineResults.SchemaPush> {
    return this.runCommand(this.getRPCPayload('schemaPush', args))
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
      if (result.id) {
        if (!this.listeners[result.id]) {
          console.error(`Got result for unknown id ${result.id}`)
        }
        if (this.listeners[result.id]) {
          this.listeners[result.id](result)
          delete this.listeners[result.id]
        }
      } else {
        // If the error happens before the JSON-RPC sever starts, the error doesn't have an id
        if (result.is_panic) {
          throw new Error(`Response: ${result.message}`)
        } else if (result.message) {
          console.error(chalk.red(`Response: ${result.message}`))
        } else {
          console.error(chalk.red(`Response: ${JSON.stringify(result)}`))
        }
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { PWD, ...rest } = process.env
        const binaryPath = await resolveBinary(BinaryType.migrationEngine)
        debugRpc('starting migration engine with binary: ' + binaryPath)
        const args = ['-d', this.schemaPath]
        if (
          this.enabledPreviewFeatures &&
          Array.isArray(this.enabledPreviewFeatures) &&
          this.enabledPreviewFeatures.length > 0
        ) {
          args.push(
            ...[
              '--enabled-preview-features',
              this.enabledPreviewFeatures.join(','),
            ],
          )
        }
        this.child = spawn(binaryPath, args, {
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
          this.rejectAll(err)
          reject(err)
        })

        this.child.on('exit', (code: number | null): void => {
          const exitWithErr = (err: RustPanic | Error): void => {
            this.rejectAll(err)
            reject(err)
          }
          const engineMessage =
            this.lastError?.message || this.messages.join('\n')
          const handlePanic = () => {
            const stackTrace = this.messages.join('\n')
            exitWithErr(
              new RustPanic(
                serializePanic(engineMessage),
                stackTrace,
                this.lastRequest,
                ErrorArea.LIFT_CLI,
                this.schemaPath,
              ),
            )
          }

          switch (code) {
            case MigrateEngineExitCode.Success:
              break
            case MigrateEngineExitCode.Error:
              exitWithErr(
                new Error(`Error in migration engine: ${engineMessage}`),
              )
              break
            case MigrateEngineExitCode.Panic:
              handlePanic()
              break
            // treat unknown error codes as panics
            default:
              handlePanic()
          }
        })

        this.child.stdin!.on('error', (err) => {
          debugStdin(err)
        })

        byline(this.child.stderr).on('data', (msg) => {
          const data = String(msg)
          debugStderr(data)

          try {
            const json: MigrateEngineLogLine = JSON.parse(data)

            if (json.fields?.migrate_action === 'log') {
              // TODO uncomment in a separate PR and update snapshots
              //console.info(json.fields.message)
            }

            this.messages.push(json.fields.message)

            if (json.level === 'ERROR') {
              this.lastError = json.fields
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
        // can be null, for reset RPC for example
        if (response.result !== undefined) {
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
                  }\n`,
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

  private getRPCPayload(method: string, params: any): RPCPayload {
    return {
      id: messageId++,
      jsonrpc: '2.0',
      method,
      params: {
        ...params,
      },
    }
  }
}

/** The full message with context we return to the user in case of engine panic. */
function serializePanic(log: string): string {
  return `${chalk.red.bold('Error in migration engine.\nReason: ')}${chalk.red(
    `${log}`,
  )}

Please create an issue with your \`schema.prisma\` at
${chalk.underline('https://github.com/prisma/prisma/issues/new')}\n`
}
