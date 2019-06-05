import { spawn } from 'child_process'
import byline from './utils/byline'
import { EngineArgs, EngineResults } from './types'
import debugLib from 'debug'
import chalk from 'chalk'
import util from 'util'
const debug = debugLib('LiftEngine')
const debugRpc = debugLib('LiftEngine:rpc')
const debugStderr = debugLib('LiftEngine:stderr')

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
            debugRpc(
              `RECEIVING RPC ANSWER`,
              util.inspect(result.result, { depth: null }),
            )
            resolve(result.result)
          } else {
            if (result.error) {
              console.error(result)
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
  applyMigration(
    args: EngineArgs.ApplyMigration,
  ): Promise<EngineResults.ApplyMigration> {
    return this.runCommand(this.getRPCPayload('applyMigration', args))
  }
  calculateDatamodel(
    args: EngineArgs.CalculateDatamodel,
  ): Promise<EngineResults.CalculateDatamodel> {
    return this.runCommand(this.getRPCPayload('calculateDatamodel', args))
  }
  calculateDatabaseSteps(
    args: EngineArgs.CalculateDatabaseSteps,
  ): Promise<EngineResults.ApplyMigration> {
    return this.runCommand(this.getRPCPayload('calculateDatabaseSteps', args))
  }
  inferMigrationSteps(
    args: EngineArgs.InferMigrationSteps,
  ): Promise<EngineResults.InferMigrationSteps> {
    return this.runCommand(this.getRPCPayload('inferMigrationSteps', args))
  }
  listMigrations(): Promise<EngineResults.ListMigrations> {
    return this.runCommand(this.getRPCPayload('listMigrations', {}))
  }
  migrationProgess(
    args: EngineArgs.MigrationProgress,
  ): Promise<EngineResults.MigrationProgress> {
    return this.runCommand(this.getRPCPayload('migrationProgress', args))
  }
}
