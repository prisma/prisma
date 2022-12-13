import Debug from '@prisma/debug'
import { BinaryType } from '@prisma/fetch-engine'
import chalk from 'chalk'
import type { ChildProcess } from 'child_process'
import { spawn } from 'child_process'

import { ErrorArea, RustPanic } from './panic'
import { resolveBinary } from './resolveBinary'
import byline from './utils/byline'

const debugCli = Debug('prisma:introspectionEngine:cli')
const debugRpc = Debug('prisma:introspectionEngine:rpc')
const debugStderr = Debug('prisma:introspectionEngine:stderr')
const debugStdin = Debug('prisma:introspectionEngine:stdin')

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

export class IntrospectionPanic extends Error {
  public request: any
  public rustStack: string
  constructor(message: string, rustStack: string, request: any) {
    super(message)
    this.rustStack = rustStack
    this.request = request
  }
}

export class IntrospectionError extends Error {
  public code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

// See prisma-engines
// SQL https://github.com/prisma/prisma-engines/blob/main/introspection-engine/connectors/sql-introspection-connector/src/warnings.rs
// Mongo https://github.com/prisma/prisma-engines/blob/main/introspection-engine/connectors/mongodb-introspection-connector/src/warnings.rs
export type IntrospectionWarnings =
  | IntrospectionWarningsUnhandled
  | IntrospectionWarningsInvalidReintro
  | IntrospectionWarningsMissingUnique
  | IntrospectionWarningsEmptyFieldName
  | IntrospectionWarningsUnsupportedType
  | IntrospectionWarningsInvalidEnumName
  | IntrospectionWarningsCuidPrisma1
  | IntrospectionWarningsUuidPrisma1
  | IntrospectionWarningsFieldModelReintro
  | IntrospectionWarningsFieldMapReintro
  | IntrospectionWarningsEnumMapReintro
  | IntrospectionWarningsEnumValueMapReintro
  | IntrospectionWarningsCuidReintro
  | IntrospectionWarningsUuidReintro
  | IntrospectionWarningsUpdatedAtReintro
  | IntrospectionWarningsWithoutColumns
  | IntrospectionWarningsModelsWithIgnoreReintro
  | IntrospectionWarningsFieldsWithIgnoreReintro
  | IntrospectionWarningsCustomIndexNameReintro
  | IntrospectionWarningsCustomPrimaryKeyNamesReintro
  | IntrospectionWarningsRelationsReintro
  | IntrospectionWarningsMongoMultipleTypes
  | IntrospectionWarningsMongoFieldsPointingToAnEmptyType
  | IntrospectionWarningsMongoFieldsWithUnknownTypes
  | IntrospectionWarningsMongoFieldsWithEmptyNames

type AffectedModel = { model: string }
type AffectedModelAndIndex = { model: string; index_db_name: string }
type AffectedModelAndField = { model: string; field: string }
type AffectedModelAndFieldAndType = {
  model: string
  field: string
  tpe: string
}
type AffectedModelOrCompositeTypeAndField = {
  // Either compositeType or model is defined
  compositeType?: string
  model?: string
  field: string
}
type AffectedModelOrCompositeTypeAndFieldAndType = AffectedModelOrCompositeTypeAndField & {
  tpe: string
}
type AffectedEnum = { enm: string }
type AffectedEnumAndValue = { enm: string; value: string }

interface IntrospectionWarning {
  code: number
  message: string
  affected:
    | AffectedModel[]
    | AffectedModelAndIndex[]
    | AffectedModelAndField[]
    | AffectedModelAndFieldAndType[]
    | AffectedModelOrCompositeTypeAndField[]
    | AffectedModelOrCompositeTypeAndFieldAndType[]
    | AffectedEnum[]
    | AffectedEnumAndValue[]
    | null
}

interface IntrospectionWarningsUnhandled extends IntrospectionWarning {
  code: -1 // -1 doesn't exist, it's just for the types
  affected: any
}
interface IntrospectionWarningsInvalidReintro extends IntrospectionWarning {
  code: 0
  affected: null
}
interface IntrospectionWarningsMissingUnique extends IntrospectionWarning {
  code: 1
  affected: AffectedModel[]
}
interface IntrospectionWarningsEmptyFieldName extends IntrospectionWarning {
  code: 2
  affected: AffectedModelAndField[]
}
interface IntrospectionWarningsUnsupportedType extends IntrospectionWarning {
  code: 3
  affected: AffectedModelAndFieldAndType[]
}
interface IntrospectionWarningsInvalidEnumName extends IntrospectionWarning {
  code: 4
  affected: AffectedEnumAndValue[]
}
interface IntrospectionWarningsCuidPrisma1 extends IntrospectionWarning {
  code: 5
  affected: AffectedModelAndField[]
}
interface IntrospectionWarningsUuidPrisma1 extends IntrospectionWarning {
  code: 6
  affected: AffectedModelAndField[]
}
interface IntrospectionWarningsFieldModelReintro extends IntrospectionWarning {
  code: 7
  affected: AffectedModel[]
}
interface IntrospectionWarningsFieldMapReintro extends IntrospectionWarning {
  code: 8
  affected: AffectedModelAndField[]
}
interface IntrospectionWarningsEnumMapReintro extends IntrospectionWarning {
  code: 9
  affected: AffectedEnum[]
}
interface IntrospectionWarningsEnumValueMapReintro extends IntrospectionWarning {
  code: 10
  affected: AffectedEnum[]
}
interface IntrospectionWarningsCuidReintro extends IntrospectionWarning {
  code: 11
  affected: AffectedModelAndField[]
}
interface IntrospectionWarningsUuidReintro extends IntrospectionWarning {
  code: 12
  affected: AffectedModelAndField[]
}
interface IntrospectionWarningsUpdatedAtReintro extends IntrospectionWarning {
  code: 13
  affected: AffectedModelAndField[]
}
interface IntrospectionWarningsWithoutColumns extends IntrospectionWarning {
  code: 14
  affected: AffectedModel[]
}
interface IntrospectionWarningsModelsWithIgnoreReintro extends IntrospectionWarning {
  code: 15
  affected: AffectedModel[]
}
interface IntrospectionWarningsFieldsWithIgnoreReintro extends IntrospectionWarning {
  code: 16
  affected: AffectedModelAndField[]
}
interface IntrospectionWarningsCustomIndexNameReintro extends IntrospectionWarning {
  code: 17
  affected: AffectedModelAndIndex[]
}
interface IntrospectionWarningsCustomPrimaryKeyNamesReintro extends IntrospectionWarning {
  code: 18
  affected: AffectedModel[]
}
interface IntrospectionWarningsRelationsReintro extends IntrospectionWarning {
  code: 19
  affected: AffectedModel[]
}

// MongoDB starts at 101 see
// https://github.com/prisma/prisma-engines/blob/main/introspection-engine/connectors/mongodb-introspection-connector/src/warnings.rs#L39-L43
interface IntrospectionWarningsMongoMultipleTypes extends IntrospectionWarning {
  code: 101
  affected: AffectedModelOrCompositeTypeAndFieldAndType[]
}
interface IntrospectionWarningsMongoFieldsPointingToAnEmptyType extends IntrospectionWarning {
  code: 102
  affected: AffectedModelOrCompositeTypeAndField[]
}
interface IntrospectionWarningsMongoFieldsWithUnknownTypes extends IntrospectionWarning {
  code: 103
  affected: AffectedModelOrCompositeTypeAndField[]
}
interface IntrospectionWarningsMongoFieldsWithEmptyNames extends IntrospectionWarning {
  code: 104
  affected: AffectedModelOrCompositeTypeAndField[]
}

export type IntrospectionSchemaVersion = 'Prisma2' | 'Prisma1' | 'Prisma11' | 'NonPrisma'

let messageId = 1

export class IntrospectionEngine {
  private debug: boolean
  private cwd: string
  private child?: ChildProcess
  private listeners: { [key: string]: (result: any, err?: any) => any } = {}
  private messages: string[] = []
  private lastRequest?: any
  private lastError?: any
  private initPromise?: Promise<void>
  private lastUrl?: string
  public isRunning = false
  constructor(
    { debug, cwd }: IntrospectionEngineOptions = {
      debug: false,
      cwd: process.cwd(),
    },
  ) {
    if (debug) {
      Debug.enable('IntrospectionEngine*')
    }
    this.debug = Boolean(debug)
    this.cwd = cwd || process.cwd()
  }
  public stop(): void {
    if (this.child) {
      this.child.kill()
      this.isRunning = false
    }
  }
  private rejectAll(err: any): void {
    Object.entries(this.listeners).map(([id, listener]) => {
      listener(null, err)
      delete this.listeners[id]
    })
  }
  private registerCallback(id: number, callback: (result: any, err?: Error) => any): void {
    this.listeners[id] = callback
  }
  public getDatabaseDescription(schema: string): Promise<string> {
    return this.runCommand(this.getRPCPayload('getDatabaseDescription', { schema }))
  }
  public getDatabaseVersion(schema: string): Promise<string> {
    return this.runCommand(this.getRPCPayload('getDatabaseVersion', { schema }))
  }

  // @deprecated
  // public introspect(
  //   schema: string,
  //   force?: Boolean,
  //   compositeTypeDepth = -1, // optional, only for mongodb
  // ): Promise<{
  //   datamodel: string
  //   warnings: IntrospectionWarnings[]
  //   version: IntrospectionSchemaVersion
  // }> {
  //   this.lastUrl = schema
  //   return this.runCommand(this.getRPCPayload('introspect', { schema, force, compositeTypeDepth }))
  // }
  public debugPanic(): Promise<any> {
    return this.runCommand(this.getRPCPayload('debugPanic', undefined))
  }
  public getDatabaseMetadata(schema: string): Promise<{ size_in_bytes: number; table_count: number }> {
    this.lastUrl = schema
    return this.runCommand(this.getRPCPayload('getDatabaseMetadata', { schema }))
  }
  private handleResponse(response: any): void {
    let result
    try {
      result = JSON.parse(response)
    } catch (e) {
      console.error(`Could not parse introspection engine response: ${response.slice(0, 200)}`)
    }
    if (result) {
      if (result.backtrace) {
        // if there is a backtrace on the result, it's probably an error
        console.log(result)
      }
      if (!result.id) {
        console.error(`Response ${JSON.stringify(result)} doesn't have an id and I can't handle that (yet)`)
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
    return new Promise(
      // eslint-disable-next-line no-async-promise-executor, @typescript-eslint/no-misused-promises
      async (resolve, reject): Promise<void> => {
        try {
          const binaryPath = await resolveBinary(BinaryType.introspectionEngine)
          debugRpc('starting introspection engine with binary: ' + binaryPath)

          this.child = spawn(binaryPath, {
            env: process.env,
            // If the process is spawned from another directory, all file paths would resolve relative to that instead of the prisma directory
            // note that it isn't something engines specific but just a process spawning thing.
            // Paths resolved in engines code include at least:
            // sqlite database paths
            // ssl certificate paths
            cwd: this.cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
          })

          this.isRunning = true

          this.child.on('error', (err) => {
            console.error('[introspection-engine] error: %s', err)
            this.child?.kill()
            this.rejectAll(err)
            reject(err)
          })

          this.child.stdin?.on('error', (err) => {
            console.error(err)
            this.child?.kill()
          })

          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          this.child.on('exit', (code) => {
            // handle panics
            this.isRunning = false
            if (code === 255 && this.lastError && this.lastError.is_panic) {
              const err = new RustPanic(
                this.lastError.message,
                this.lastError.backtrace,
                this.lastRequest,
                ErrorArea.INTROSPECTION_CLI,
                /* schemaPath */ undefined,
                /* schema */ this.lastUrl,
              )
              this.rejectAll(err)
              reject(err)
              return
            }
            const messages = this.messages.join('\n')
            let err: any
            if (code !== 0 || messages.includes('panicked at')) {
              let errorMessage = chalk.red.bold('Error in introspection engine: ') + messages
              if (this.lastError && this.lastError.msg === 'PANIC') {
                errorMessage = serializePanic(this.lastError)
                err = new IntrospectionPanic(errorMessage, messages, this.lastRequest)
              } else if (messages.includes('panicked at')) {
                err = new IntrospectionPanic(errorMessage, messages, this.lastRequest)
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
              debugCli(e)
            }
          })

          byline(this.child.stdout).on('data', (line) => {
            this.handleResponse(String(line))
          })

          setImmediate(() => {
            resolve()
          })
        } catch (e) {
          this.child?.kill()
          reject(e)
        }
      },
    )
  }
  private async runCommand(request: RPCPayload): Promise<any> {
    await this.init()
    if (process.env.FORCE_PANIC_INTROSPECTION_ENGINE) {
      request = this.getRPCPayload('debugPanic', undefined)
    }

    if (this.child?.killed) {
      throw new Error(`Can't execute ${JSON.stringify(request)} because introspection engine already exited.`)
    }
    return new Promise((resolve, reject) => {
      this.registerCallback(request.id, (response, err) => {
        if (err) {
          return reject(err)
        }
        if (typeof response.result !== 'undefined') {
          resolve(response.result)
        } else {
          if (response.error) {
            this.child?.kill()
            debugRpc(response)
            if (response.error.data?.is_panic) {
              const message = response.error.data?.error?.message ?? response.error.message
              reject(
                new RustPanic(
                  message,
                  message,
                  request,
                  ErrorArea.INTROSPECTION_CLI,
                  /* schemaPath */ undefined,
                  /* schema */ this.lastUrl,
                ),
              )
            } else if (response.error.data?.message) {
              // Print known error code & message from engine
              // See known errors at https://github.com/prisma/specs/tree/master/errors#prisma-sdk
              let message = `${response.error.data.message}\n`
              if (response.error.data?.error_code) {
                message = chalk.redBright(`${response.error.data.error_code}\n\n`) + message
                reject(new IntrospectionError(message, response.error.data.error_code))
              } else {
                reject(new Error(message))
              }
            } else {
              reject(
                new Error(
                  `${chalk.redBright('Error in RPC')}\n Request: ${JSON.stringify(
                    request,
                    null,
                    2,
                  )}\nResponse: ${JSON.stringify(response, null, 2)}\n${response.error.message}\n`,
                ),
              )
            }
          } else {
            reject(new Error(`Got invalid RPC response without .result property: ${JSON.stringify(response)}`))
          }
        }
      })
      if (this.child!.stdin!.destroyed) {
        throw new Error(`Can't execute ${JSON.stringify(request)} because introspection engine is destroyed.`)
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
      params: params ? [{ ...params }] : undefined,
    }
  }
}

function serializePanic(log): string {
  return `${chalk.red.bold('Error in introspection engine.\nReason: ')}
${log.reason} in ${chalk.underline(`${log.file}:${log.line}:${log.column}`)}

Please create an issue in the ${chalk.bold('prisma')} repo with the error 🙏:
${chalk.underline('https://github.com/prisma/prisma/issues/new')}\n`
}
