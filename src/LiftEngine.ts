import path from 'path'
import { spawn } from 'child_process'
import byline from './utils/byline'
import { EngineArgs, EngineResults } from './types'
import debugLib from 'debug'
import chalk from 'chalk'
const debug = debugLib('LiftEngine')
const debugStderr = debugLib('LiftEngine:stderr')

// enum StepType {
//   CreateModel = 'CreateModel',
//   UpdateModel = 'UpdateModel',
//   DeleteModel = 'DeleteModel',
//   CreateField = 'CreateField',
//   UpdateField = 'UpdateField',
//   DeleteField = 'DeleteField',
// }

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
    binaryPath = path.resolve(__dirname, '../migration-engine'),
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
        reject(
          new Error(
            `${chalk.redBright('Error in lift engine:')} ${messages.join('')}`,
          ),
        )
      })

      child.on('exit', (code, signal) => {
        if (code !== 0) {
          console.error(
            '[migration-engine] exit: code=%s signal=%s',
            code,
            signal,
          )
        }
        reject(
          new Error(
            `${chalk.redBright('Error in lift engine:')} ${messages.join('')}`,
          ),
        )
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
            resolve(result.result)
          } else {
            if (result.error) {
              console.log(result)
              reject(new Error(result.error.message))
            } else {
              reject(
                new Error(
                  `Got invalid RPC response without .result property: ${JSON.stringify(
                    result,
                  )}`,
                ),
              )
            }
          }
        } catch (e) {
          debug(lineString)
        }
      })

      child.stdin!.write(JSON.stringify(request) + '\n')
    })
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
  applyMigration(args: EngineArgs.ApplyMigration): Promise<any> {
    return this.runCommand(this.getRPCPayload('applyMigration', args))
  }
  inferMigrationSteps(args: EngineArgs.InferMigrationSteps): Promise<any> {
    return this.runCommand(this.getRPCPayload('inferMigrationSteps', args))
  }
  listMigrations(): Promise<any> {
    return this.runCommand(this.getRPCPayload('listMigrations', {}))
  }
  migrationProgess(
    args: EngineArgs.MigrationProgress,
  ): Promise<EngineResults.MigrationProgress> {
    return this.runCommand(this.getRPCPayload('migrationProgress', args))
  }
}
