import { spawn } from 'child_process'
import byline from './utils/byline'
import { EngineArgs, EngineResults } from './types'
import debugLib from 'debug'
import chalk from 'chalk'
import util from 'util'
const debug = debugLib('LiftEngine')
const debugRpc = debugLib('LiftEngine:rpc')
const debugStderr = debugLib('LiftEngine:stderr')
import fs from 'fs'

export type LiftEngineOptions = {
  projectDir: string
  binaryPath?: string
  debug?: boolean
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
          // console.error(
          //   '[migration-engine] exit: code=%s signal=%s',
          //   code,
          //   signal,
          // )
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
    const filename = `failed-${request.method}.md`
    fs.writeFileSync(
      filename,
      `# Failed ${request.method}
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
  unapplyMigration(): Promise<EngineResults.UnapplyMigration> {
    return this.runCommand(this.getRPCPayload('unapplyMigration', {}))
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
  listMigrations(): Promise<EngineResults.ListMigrations> {
    return this.runCommand(this.getRPCPayload('listMigrations', {}))
  }
  convertDmmfToDml(args: EngineArgs.DmmfToDml): Promise<EngineResults.DmmfToDml> {
    return this.runCommand(
      this.getRPCPayload('convertDmmfToDml', {
        dataSources: args.dataSources.map(uglifySource),
        dmmf: args.dmmf,
      } as EngineArgs.DmmfToDml),
    )
  }
  listDataSources(args: EngineArgs.ListDataSources): Promise<EngineResults.ListDataSources> {
    return this.runCommand(this.getRPCPayload('listDataSources', args))
  }
  // Helper function, oftentimes we just want the applied migrations
  async listAppliedMigrations(): Promise<EngineResults.ListMigrations> {
    const migrations = await this.runCommand(this.getRPCPayload('listMigrations', {}))
    return migrations.filter(m => m.status === 'Success')
  }
  migrationProgess(args: EngineArgs.MigrationProgress): Promise<EngineResults.MigrationProgress> {
    return this.runCommand(this.getRPCPayload('migrationProgress', args))
  }
}

function uglifySource(source) {
  return {
    tpe: source.type,
    name: source.name,
    url: source.url,
  }
}
