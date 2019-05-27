import path from 'path'
import { spawn } from 'child_process'
import byline from './utils/byline'
import { EngineArgs } from './types'
import debugLib from 'debug'
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
  constructor({
    projectDir,
    binaryPath = path.resolve(__dirname, '../migration-engine'),
    debug = true,
  }: LiftEngineOptions) {
    this.projectDir = projectDir
    this.binaryPath = binaryPath
    if (debug) {
      debugLib.enable('LiftEngine')
    }
  }
  private runCommand(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.binaryPath, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          SERVER_ROOT: this.projectDir,
        },
      })

      child.on('error', err => {
        console.error('[migration-engine] error: %s', err)
        reject(err)
      })

      child.on('exit', (code, signal) => {
        if (code !== 0) {
          console.error('[migration-engine] exit: code=%s signal=%s', code, signal)
        }
        reject()
      })

      child.stderr.on('data', data => {
        debugStderr(data.toString())
      })

      const out = byline(child.stdout)
      out.on('data', line => {
        const lineString = line.toString()
        try {
          const result = JSON.parse(lineString)
          resolve(result)
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
  migrationProgess(args: EngineArgs.MigrationProgress): Promise<any> {
    return this.runCommand(this.getRPCPayload('migrationProgress', args))
  }
}
