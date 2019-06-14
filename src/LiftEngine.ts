import { spawn } from 'child_process'
import byline from './utils/byline'
import { EngineArgs, EngineResults, ConfigMetaFormat } from './types'
import debugLib from 'debug'
import chalk from 'chalk'
import util from 'util'
const debug = debugLib('LiftEngine')
const debugRpc = debugLib('LiftEngine:rpc')
const debugStderr = debugLib('LiftEngine:stderr')
import fs from 'fs'
import { now } from './utils/now'

export type LiftEngineOptions = {
  projectDir: string
  binaryPath?: string
  debug?: boolean
}

export class EngineError extends Error {
  code: number
  constructor(message: string, code: number) {
    super(message)
    this.code = code
  }
}

export class LiftEngine {
  private binaryPath: string
  private projectDir: string
  private debug: boolean
  constructor({
    projectDir,
    binaryPath = eval(`require('path').join(__dirname, '../migration-engine')`), // ncc go home
    debug = false,
  }: LiftEngineOptions) {
    this.projectDir = projectDir
    this.binaryPath = binaryPath
    if (debug) {
      debugLib.enable('LiftEngine')
      debugLib.enable('LiftEngine:stderr')
    }
    this.debug = debug
  }
  private runCommand(request: any): Promise<any> {
    debugRpc('SENDING RPC CALL', util.inspect(request, { depth: null }))
    return new Promise((resolve, reject) => {
      const messages: string[] = []
      const child = spawn(this.binaryPath, {
        stdio: ['pipe', 'pipe', this.debug ? process.stderr : 'pipe'],
        env: {
          ...process.env,
          SERVER_ROOT: this.projectDir,
          RUST_BACKTRACE: '1',
        },
      })

      child.on('error', err => {
        console.error('[migration-engine] error: %s', err)
        reject(new Error(`${chalk.redBright('Error in lift engine:')} ${messages.join('')}`))
      })

      child.on('exit', (code, signal) => {
        if (code !== 0) {
          this.persistError(request, null, messages)
          reject(
            new Error(`${chalk.redBright(`Error in lift engine for rpc ${request.method}:`)}\n  ${messages.join('')}`),
          )
        }
      })

      if (!this.debug) {
        child.stderr!.on('data', data => {
          messages.push(data.toString())
          debugStderr(data.toString())
        })
      }

      const out = byline(child.stdout)
      out.on('data', line => {
        const lineString = line.toString()
        try {
          const result = JSON.parse(lineString)
          if (result.result) {
            debugRpc(`RECEIVING RPC ANSWER`, util.inspect(result.result, { depth: null }))
            resolve(result.result)
          } else {
            if (result.error) {
              if (result.error.data && result.error.data.error && result.error.data.code) {
                reject(new EngineError(result.error.data.error, result.error.data.code))
              } else {
                const text = this.persistError(request, result, messages)
                reject(
                  new Error(
                    `${chalk.redBright('Error in RPC')}\n Request: ${JSON.stringify(
                      request,
                      null,
                      2,
                    )}\nResponse: ${JSON.stringify(result, null, 2)}\n${result.error.message}\n\n${text}\n`,
                  ),
                )
              }
            } else {
              reject(new Error(`Got invalid RPC response without .result property: ${JSON.stringify(result)}`))
            }
          }
        } catch (e) {
          debug(lineString)
        }
      })

      child.stdin!.write(JSON.stringify(request) + '\n')
    })
  }
  private persistError(request: any, response: any, messages: string[]): string {
    // if (debugLib.enabled('LiftEngine') || debugLib.enabled('LiftEngine:rpc')) {
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
  private getRPCPayload(method: string, params: any) {
    return {
      id: 1,
      jsonrpc: '2.0',
      method,
      params: {
        projectInfo: '',
        ...params,
      },
    }
  }
  applyMigration(args: EngineArgs.ApplyMigration): Promise<EngineResults.ApplyMigration> {
    return this.runCommand(this.getRPCPayload('applyMigration', args))
  }
  unapplyMigration(args: EngineArgs.UnapplyMigration): Promise<EngineResults.UnapplyMigration> {
    return this.runCommand(this.getRPCPayload('unapplyMigration', args))
  }
  calculateDatamodel(args: EngineArgs.CalculateDatamodel): Promise<EngineResults.CalculateDatamodel> {
    return this.runCommand(this.getRPCPayload('calculateDatamodel', args))
  }
  calculateDatabaseSteps(args: EngineArgs.CalculateDatabaseSteps): Promise<EngineResults.ApplyMigration> {
    return this.runCommand(this.getRPCPayload('calculateDatabaseSteps', args))
  }
  inferMigrationSteps(args: EngineArgs.InferMigrationSteps): Promise<EngineResults.InferMigrationSteps> {
    return this.runCommand(this.getRPCPayload('inferMigrationSteps', args))
  }
  // Helper function, oftentimes we just want the applied migrations
  async listAppliedMigrations(args: EngineArgs.ListMigrations): Promise<EngineResults.ListMigrations> {
    const migrations = await this.runCommand(this.getRPCPayload('listMigrations', args))
    return migrations.filter(m => m.status === 'Success')
  }
  convertDmmfToDml(args: EngineArgs.DmmfToDml): Promise<EngineResults.DmmfToDml> {
    return this.runCommand(this.getRPCPayload('convertDmmfToDml', args))
  }
  getConfig(args: EngineArgs.GetConfig): Promise<ConfigMetaFormat> {
    return this.runCommand(this.getRPCPayload('getConfig', args))
  }
  migrationProgess(args: EngineArgs.MigrationProgress): Promise<EngineResults.MigrationProgress> {
    return this.runCommand(this.getRPCPayload('migrationProgress', args))
  }
}
