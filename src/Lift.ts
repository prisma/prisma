import { LiftEngine } from './LiftEngine'
import fs from 'fs'
import path from 'path'
import { now } from './utils/now'
import { promisify } from 'util'
import { FileMap, LockFile, Migration } from './types'
import {
  deserializeLockFile,
  initLockFile,
  serializeLockFile,
} from './utils/LockFile'
import globby from 'globby'
import { deepEqual } from 'fast-equals'
import { printDatamodelSteps } from './utils/printDatamodelSteps'
import { printDatabaseSteps } from './utils/printDatabaseSteps'
import cleur from './utils/cleur'
import indent from 'indent-string'
import { printMigrationReadme } from './utils/printMigrationReadme'
import { printDatamodelDiff } from './utils/printDatamodelDiff'
import chalk from 'chalk'
import { highlightDatamodel } from './utils/highlightDatamodel'

const readFile = promisify(fs.readFile)
const exists = promisify(fs.exists)

export class Lift {
  engine: LiftEngine
  constructor(protected projectDir: string) {
    this.engine = new LiftEngine({ projectDir })
  }
  public async run() {
    const stepsResult = await this.engine.inferMigrationSteps({
      dataModel: fs.readFileSync(
        path.resolve(this.projectDir, 'datamodel.prisma'),
        'utf-8',
      ),
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

  public async getLockFile(): Promise<LockFile> {
    const lockFilePath = path.resolve(
      this.projectDir,
      'migrations',
      'lift.lock',
    )
    if (await exists(lockFilePath)) {
      const file = await readFile(lockFilePath, 'utf-8')
      return deserializeLockFile(file)
    }

    return initLockFile()
  }

  public async create(
    name?: string,
    preview?: boolean,
  ): Promise<
    { files: FileMap; migrationId: string; newLockFile: string } | undefined
  > {
    const timestamp = now()
    const migrationId = timestamp + (name ? `-${name}` : '')
    const lockFile = await this.getLockFile()
    if (lockFile.remoteBranch) {
      // TODO: Implement handling the conflict
      throw new Error(
        `There's a merge conflict in the ${chalk.bold(
          'migrations/lift.lock',
        )} file. Please execute ${chalk.greenBright(
          'prisma lift fix',
        )} to solve it`,
      )
    }
    const datamodel = await this.getDatamodel()
    const lastDatamodel = await this.getLastDatamodel()
    const result = await this.engine.inferMigrationSteps({
      dataModel: datamodel,
      migrationId,
    })
    const { datamodelSteps, databaseSteps } = result
    if (databaseSteps.length === 0) {
      return undefined
    }

    const localMigrations = await this.getLocalMigrations()
    if (localMigrations.length > 0) {
      const lastLocalMigration = localMigrations.slice(-1)[0]
      // TODO: as soon as the backend returns the actual steps, we need to check for datamodelSteps.length === 0
      if (deepEqual(lastLocalMigration.steps, datamodelSteps)) {
        return undefined
      }
    }

    const nameStr = name ? ` --name ${chalk.bold(name)}` : ''
    const previewStr = preview ? ` --preview` : ''
    console.log(`\n🏋️‍ lift create${nameStr}${previewStr}`)
    if (lastDatamodel) {
      const wording = preview
        ? `Potential datamodel changes:`
        : 'Datamodel Changes:'
      console.log(cleur.bold(`\n${wording}\n`))
    } else {
      const brightGreen = chalk.rgb(127, 224, 152)
      console.log(brightGreen.bold('\nNew datamodel:\n'))
    }
    if (lastDatamodel) {
      console.log(indent(printDatamodelDiff(lastDatamodel, datamodel), 2))
    } else {
      console.log(indent(highlightDatamodel(datamodel), 2))
    }

    lockFile.localMigrations.push(migrationId)
    const newLockFile = serializeLockFile(lockFile)

    return {
      migrationId,
      files: {
        ['steps.json']: JSON.stringify(datamodelSteps, null, 2),
        ['datamodel.prisma']: datamodel,
        ['README.md']: printMigrationReadme({
          migrationId,
          lastMigrationId: 'last migration id', //TODO
          datamodelA: '',
          datamodelB: datamodel,
        }),
      },
      newLockFile,
    }
  }

  public async getLastDatamodel(): Promise<string | undefined> {
    const migrationsDir = path.join(this.projectDir, 'migrations')
    if (!(await exists(migrationsDir))) {
      return undefined
    }
    const datamodelFiles = await globby('**/datamodel.prisma', {
      cwd: migrationsDir,
    })
    return readFile(
      path.join(migrationsDir, datamodelFiles.slice(-1)[0]),
      'utf-8',
    )
  }

  private async getLocalMigrations(): Promise<Migration[]> {
    const migrationsDir = path.join(this.projectDir, 'migrations')
    if (!(await exists(migrationsDir))) {
      return []
    }
    const migrationSteps = await globby('**/steps.json', {
      cwd: migrationsDir,
    }).then(files =>
      Promise.all(
        files.map(async fileName => ({
          fileName,
          file: await readFile(path.join(migrationsDir, fileName), 'utf-8'),
        })),
      ),
    )

    return migrationSteps.map(({ fileName, file }) => ({
      id: fileName.split('.')[0],
      steps: JSON.parse(file),
    }))
  }

  public async up(): Promise<string> {
    const localMigrations = await this.getLocalMigrations()
    const remoteMigrations = await this.engine.listMigrations()
    if (remoteMigrations.length > localMigrations.length) {
      throw new Error(
        `There are more migrations in the database than locally. This must not happen`,
      )
    }

    const migrationsToApply = localMigrations.filter(
      (localMigration, index) => {
        const remoteMigration = remoteMigrations[index]
        if (remoteMigration) {
          if (localMigration.id !== remoteMigration.id) {
            throw new Error(
              `Local and remote migrations are not in lockstep. We have migration ${
                localMigration.id
              } locally and ${
                remoteMigration.id
              } remotely at the same position in the history.`,
            )
          }
          return false
        }
        return true
      },
    )
    if (migrationsToApply.length === 0) {
      return 'All migrations are already applied'
    }
    for (const { id, steps } of migrationsToApply) {
      console.log(`Applying migration ${id}`)
      const result = await this.engine.applyMigration({
        force: false,
        migrationId: id,
        steps: steps,
      })
      const progress = await this.engine.migrationProgess({
        migrationId: id,
      })
      if (progress.status === 'Success') {
        console.log(`Done`)
      } else {
        throw new Error(`Oops. ${JSON.stringify(progress)}`)
      }
    }
    return ''
  }
}
