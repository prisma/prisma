import chalk from 'chalk'
import { ChildProcess, spawn } from 'child_process'
import debugLib from 'debug'
import util from 'util'
import { ConfigMetaFormat, EngineArgs, EngineResults } from './types'
import byline from './utils/byline'
const debugRpc = debugLib('LiftEngine:rpc')
const debugStderr = debugLib('LiftEngine:stderr')
const debugStdin = debugLib('LiftEngine:stdin')
import fs from 'fs'
import { now } from './utils/now'

export interface LiftEngineOptions {
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
export class LiftEngine {
  private binaryPath: string
  private projectDir: string
  private debug: boolean
  private child?: ChildProcess
  private schemaPath: string
  private listeners: { [key: string]: (result: any) => any } = {}
  private messages: string[] = []
  constructor({
    projectDir,
    binaryPath = eval(`require('path').join(__dirname, '../migration-engine')`), // ncc go home
    debug = false,
    schemaPath,
  }: LiftEngineOptions) {
    this.projectDir = projectDir
    this.binaryPath = binaryPath
    this.schemaPath = schemaPath
    if (debug) {
      debugLib.enable('LiftEngine*')
    }
    this.debug = debug
    this.init()
  }
  public stop() {
    fs.writeFileSync('kill', '')
    this.child!.kill()
  }
  public applyMigration(args: EngineArgs.ApplyMigration): Promise<EngineResults.ApplyMigration> {
    return this.runCommand(this.getRPCPayload('applyMigration', args))
  }
  public unapplyMigration(args: EngineArgs.UnapplyMigration): Promise<EngineResults.UnapplyMigration> {
    return this.runCommand(this.getRPCPayload('unapplyMigration', args))
  }
  public calculateDatamodel(args: EngineArgs.CalculateDatamodel): Promise<EngineResults.CalculateDatamodel> {
    return this.runCommand(this.getRPCPayload('calculateDatamodel', args))
  }
  public calculateDatabaseSteps(args: EngineArgs.CalculateDatabaseSteps): Promise<EngineResults.ApplyMigration> {
    return this.runCommand(this.getRPCPayload('calculateDatabaseSteps', args))
  }
  public inferMigrationSteps(args: EngineArgs.InferMigrationSteps): Promise<EngineResults.InferMigrationSteps> {
    return this.runCommand(this.getRPCPayload('inferMigrationSteps', args))
  }
  // Helper function, oftentimes we just want the applied migrations
  public async listAppliedMigrations(args: EngineArgs.ListMigrations): Promise<EngineResults.ListMigrations> {
    const migrations = await this.runCommand(this.getRPCPayload('listMigrations', args))
    return migrations.filter(m => m.status === 'MigrationSuccess')
  }
  public convertDmmfToDml(args: EngineArgs.DmmfToDml): Promise<EngineResults.DmmfToDml> {
    return this.runCommand(this.getRPCPayload('convertDmmfToDml', args))
  }
  public getConfig(args: EngineArgs.GetConfig): Promise<ConfigMetaFormat> {
    return this.runCommand(this.getRPCPayload('getConfig', args))
  }
  public migrationProgess(args: EngineArgs.MigrationProgress): Promise<EngineResults.MigrationProgress> {
    return this.runCommand(this.getRPCPayload('migrationProgress', args))
  }
  private rejectAll(err: any) {
    Object.entries(this.listeners).map(([id, listener]) => {
      listener(err)
      delete this.listeners[id]
    })
  }
  private registerCallback(id: number, callback: (result: any) => any) {
    this.listeners[id] = callback
  }
  private handleResponse(response: any) {
    let result
    try {
      result = JSON.parse(response)
    } catch (e) {
      console.error(`Could not parse migration engine response: ${response}`)
    }
    if (result) {
      if (!result.id) {
        throw new Error(`Response ${JSON.stringify(result)} doesn't have an id and I can't handle that (yet)`)
      }
      if (!this.listeners[result.id]) {
        throw new Error(`Got result for unknown id ${result.id}`)
      }
      this.listeners[result.id](result)
      delete this.listeners[result.id]
    }
  }
  private init() {
    console.log('init')
    const { PWD, ...rest } = process.env
    this.child = spawn(this.binaryPath, ['-d', this.schemaPath], {
      cwd: this.projectDir,
      stdio: ['pipe', 'pipe', this.debug ? process.stderr : 'pipe'],
      env: {
        ...rest,
        SERVER_ROOT: this.projectDir,
        RUST_BACKTRACE: '1',
      },
    })

    this.child.on('error', err => {
      console.error('[migration-engine] error: %s', err)
      // reject(new Error(`${chalk.redBright('Error in lift engine:')} ${messages.join('')}`))
      this.rejectAll(err)
    })

    this.child.on('exit', (code, signal) => {
      if (code !== 0) {
        // this.persistError(request, null, messages)
        // TODO: get this.lastError
        this.rejectAll(new Error(`${chalk.redBright(`Error in lift engine`)}`))
      }
    })

    this.child.stdin!.on('error', err => {
      debugStdin(err)
    })

    this.child.stderr!.on('data', data => {
      const msg = String(data)
      this.messages.push(msg)
      debugStderr(msg)
    })

    const out = byline(this.child.stdout)
    out.on('data', line => {
      this.handleResponse(String(line))
    })
  }
  private runCommand(request: RPCPayload): Promise<any> {
    return new Promise((resolve, reject) => {
      this.registerCallback(request.id, response => {
        if (response.result) {
          resolve(response.result)
        }
        {
          if (response.error) {
            if (response.error.data && response.error.data.error && response.error.data.code) {
              reject(new EngineError(response.error.data.error, response.error.data.code))
            } else {
              const text = this.persistError(request, response, this.messages)
              reject(
                new Error(
                  `${chalk.redBright('Error in RPC')}\n Request: ${JSON.stringify(
                    request,
                    null,
                    2,
                  )}\nResponse: ${JSON.stringify(response, null, 2)}\n${response.error.message}\n\n${text}\n`,
                ),
              )
            }
          } else {
            reject(new Error(`Got invalid RPC response without .result property: ${JSON.stringify(response)}`))
          }
        }
      })
      debugRpc('SENDING RPC CALL', util.inspect(request, { depth: null }))
      this.child!.stdin!.write(JSON.stringify(request) + '\n')
    })
  }
  private persistError(request: any, response: any, messages: string[]): string {
    const filename = `failed-${request.method}-${now()}.md`
    fs.writeFileSync(
      filename,
      `# Failed ${request.method} at ${new Date().toISOString()}
## RPC Input One Line
\`\`\`json
${JSON.stringify(request)}
\`\`\`

## RPC Input Readable
\`\`\`json
${JSON.stringify(request, null, 2)}
\`\`\`


## RPC Response
\`\`\`
${JSON.stringify(response, null, 2)}
\`\`\`

## Stack Trace
\`\`\`bash
${messages.join('')}
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
