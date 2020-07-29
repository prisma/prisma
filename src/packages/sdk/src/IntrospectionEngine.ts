import chalk from 'chalk'
import { ChildProcess, spawn } from 'child_process'
import Debug from '@prisma/debug'
import byline from './utils/byline'
const debugRpc = Debug('IntrospectionEngine:rpc')
const debugStderr = Debug('IntrospectionEngine:stderr')
const debugStdin = Debug('IntrospectionEngine:stdin')
import fs from 'fs'
import { now } from './utils/now'
import { RustPanic, ErrorArea } from './panic'
import { resolveBinary } from './resolveBinary'

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

// See https://github.com/prisma/prisma-engines/blob/ReIntrospection/introspection-engine/connectors/sql-introspection-connector/src/warnings.rs
export type IntrospectionWarnings =
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

type AffectedModel = { model: string }[]
type AffectedModelAndField = { model: string; field: string }[]
type AffectedModelAndFieldAndType = {
  model: string
  field: string
  tpe: string
}[]
type AffectedEnum = { enm: string }[]
type AffectedEnumAndValue = { enm: string; value: string }[]

interface IntrospectionWarning {
  code: number
  message: string
  affected:
    | AffectedModel
    | AffectedModelAndField
    | AffectedModelAndFieldAndType
    | AffectedEnum
    | AffectedEnumAndValue
    | null
}

interface IntrospectionWarningsInvalidReintro extends IntrospectionWarning {
  code: 0
  affected: null
}
interface IntrospectionWarningsMissingUnique extends IntrospectionWarning {
  code: 1
  affected: AffectedModel
}
interface IntrospectionWarningsEmptyFieldName extends IntrospectionWarning {
  code: 2
  affected: AffectedModelAndField
}
interface IntrospectionWarningsUnsupportedType extends IntrospectionWarning {
  code: 3
  affected: AffectedModelAndFieldAndType
}
interface IntrospectionWarningsInvalidEnumName extends IntrospectionWarning {
  code: 4
  affected: AffectedEnumAndValue
}
interface IntrospectionWarningsCuidPrisma1 extends IntrospectionWarning {
  code: 5
  affected: AffectedModelAndField
}
interface IntrospectionWarningsUuidPrisma1 extends IntrospectionWarning {
  code: 6
  affected: AffectedModelAndField
}
interface IntrospectionWarningsFieldModelReintro extends IntrospectionWarning {
  code: 7
  affected: AffectedModel
}
interface IntrospectionWarningsFieldMapReintro extends IntrospectionWarning {
  code: 8
  affected: AffectedModelAndField
}
interface IntrospectionWarningsEnumMapReintro extends IntrospectionWarning {
  code: 9
  affected: AffectedEnum
}

export type IntrospectionSchemaVersion =
  | 'Prisma2'
  | 'Prisma1'
  | 'Prisma11'
  | 'NonPrisma'

let messageId = 1

/* tslint:disable */
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
  private registerCallback(
    id: number,
    callback: (result: any, err?: Error) => any,
  ): void {
    this.listeners[id] = callback
  }
  public getDatabaseDescription(schema: string): Promise<string> {
    return this.runCommand(
      this.getRPCPayload('getDatabaseDescription', { schema }),
    )
  }
  public introspect(
    schema: string,
    reintrospect?: Boolean,
    clean?: Boolean,
  ): Promise<{
    datamodel: string
    warnings: IntrospectionWarnings[]
    version: IntrospectionSchemaVersion
  }> {
    this.lastUrl = schema
    return this.runCommand(
      this.getRPCPayload('introspect', { schema, reintrospect, clean }),
    )
  }
  public listDatabases(schema: string): Promise<string[]> {
    this.lastUrl = schema
    return this.runCommand(this.getRPCPayload('listDatabases', { schema }))
  }
  public getDatabaseMetadata(
    schema: string,
  ): Promise<{ size_in_bytes: number; table_count: number }> {
    this.lastUrl = schema
    return this.runCommand(
      this.getRPCPayload('getDatabaseMetadata', { schema }),
    )
  }
  private handleResponse(response: any): void {
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

    return this.initPromise
  }
  private internalInit(): Promise<void> {
    return new Promise(
      // eslint-disable-next-line no-async-promise-executor, @typescript-eslint/no-misused-promises
      async (resolve, reject): Promise<void> => {
        try {
          const binaryPath = await resolveBinary('introspection-engine')
          debugRpc('starting introspection engine with binary: ' + binaryPath)

          this.child = spawn(binaryPath, {
            env: process.env,
            cwd: this.cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
          })

          this.isRunning = true

          this.child.on('error', (err) => {
            console.error('[introspection-engine] error: %s', err)
            reject(err)
            this.rejectAll(err)
          })

          this.child.stdin?.on('error', (err) => {
            console.error(err)
          })

          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          this.child.on('exit', async (code) => {
            // handle panics
            this.isRunning = false
            if (code === 255 && this.lastError && this.lastError.is_panic) {
              let sqlDump: string | undefined
              if (this.lastUrl) {
                try {
                  sqlDump = await this.getDatabaseDescription(this.lastUrl)
                } catch (e) {} // eslint-disable-line no-empty
              }
              const err = new RustPanic(
                this.lastError.message,
                this.lastError.backtrace,
                this.lastRequest,
                ErrorArea.INTROSPECTION_CLI,
                /* schemaPath */ undefined,
                /* schema */ undefined,
                sqlDump,
              )
              this.rejectAll(err)
              reject(err)
              return
            }
            const messages = this.messages.join('\n')
            let err: any
            if (code !== 0 || messages.includes('panicked at')) {
              let errorMessage =
                chalk.red.bold('Error in introspection engine: ') + messages
              if (messages.includes('\u001b[1;94m-->\u001b[0m')) {
                errorMessage =
                  `${chalk.red.bold('Schema parsing\n')}` + messages
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
      },
    )
  }
  private async runCommand(request: RPCPayload): Promise<any> {
    await this.init()
    if (this.child?.killed) {
      throw new Error(
        `Can't execute ${JSON.stringify(
          request,
        )} because introspection engine already exited.`,
      )
    }
    return new Promise((resolve, reject) => {
      this.registerCallback(request.id, async (response, err) => {
        if (err) {
          return reject(err)
        }
        if (typeof response.result !== 'undefined') {
          resolve(response.result)
        } else {
          if (response.error) {
            debugRpc(response)
            if (response.error.data?.is_panic) {
              const message =
                response.error.data?.error?.message ?? response.error.message
              // Handle error and displays the interactive dialog to send panic error
              let sqlDump: string | undefined
              if (this.lastUrl) {
                try {
                  sqlDump = await this.getDatabaseDescription(this.lastUrl)
                } catch (e) {} // eslint-disable-line no-empty
              }
              reject(
                new RustPanic(
                  message,
                  message,
                  request,
                  ErrorArea.INTROSPECTION_CLI,
                  undefined,
                  undefined,
                  sqlDump,
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
                reject(
                  new IntrospectionError(
                    message,
                    response.error.data.error_code,
                  ),
                )
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
          )} because introspection engine is destroyed.`,
        )
      }
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
    fs.writeFileSync(filename, file)
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

function serializePanic(log): string {
  return `${chalk.red.bold(
    'Error in introspection engine.\nReason: ',
  )}${chalk.red(
    `${log.reason} in ${chalk.underline(
      `${log.file}:${log.line}:${log.column}`,
    )}`,
  )}

Please create an issue in the ${chalk.bold('prisma')} repo with the error 🙏:
${chalk.underline('https://github.com/prisma/prisma/issues/new')}\n`
}
