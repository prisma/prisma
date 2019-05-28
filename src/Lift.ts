import { LiftEngine } from './LiftEngine'
import fs from 'fs'
import path from 'path'
import { now } from './utils/now'
import { promisify } from 'util'
import { FileMap, LockFile } from './types'
import { deserializeLockFile, initLockFile } from './utils/LockFile'

const readFile = promisify(fs.readFile)
const exists = promisify(fs.exists)

export class Lift {
  engine: LiftEngine
  constructor(protected projectDir: string) {
    this.engine = new LiftEngine({ projectDir })
  }
  async run() {
    const stepsResult = await this.engine.inferMigrationSteps({
      dataModel: fs.readFileSync(path.resolve(this.projectDir, 'datamodel.prisma'), 'utf-8'),
      migrationId: 'test-id2',
    })
    console.log(stepsResult)
    const applyResult = await this.engine.applyMigration({
      migrationId: 'test-id2',
      force: false,
      steps: stepsResult.datamodelSteps,
    })
    console.log(applyResult)
    const progress = await this.engine.migrationProgess({
      migrationId: 'test-id2',
    })
    console.log(progress)
    const migrations = await this.engine.listMigrations()
    console.log(migrations)
  }

  async getDatamodel() {
    const datamodelPath = path.resolve(this.projectDir, 'datamodel.prisma')
    if (!(await exists(datamodelPath))) {
      throw new Error(`Could not find ${datamodelPath}`)
    }
    return readFile(datamodelPath, 'utf-8')
  }

  async getLockFile(): Promise<LockFile> {
    const lockFilePath = path.resolve(this.projectDir, 'prisma.lock')
    if (await exists(lockFilePath)) {
      const file = await readFile(lockFilePath, 'utf-8')
      return deserializeLockFile(file)
    }

    return initLockFile()
  }

  async create(name?: string): Promise<{ files: FileMap; migrationId } | undefined> {
    const timestamp = now()
    const migrationId = timestamp + (name ? `-${name}` : '')
    const { datamodelSteps } = await this.engine.inferMigrationSteps({
      dataModel: await this.getDatamodel(),
      migrationId,
    })
    if (datamodelSteps.length === 0) {
      return undefined
    }

    return {
      migrationId,
      files: {
        [`${migrationId}/steps.json`]: JSON.stringify(datamodelSteps, null, 2),
      },
    }
  }
}
