import { LiftEngine } from './LiftEngine'
import fs from 'fs'
import path from 'path'
import { now } from './utils/now'
import { promisify } from 'util'
import { FileMap, LockFile, Migration, EngineResults } from './types'
import {
  deserializeLockFile,
  initLockFile,
  serializeLockFile,
} from './utils/LockFile'
import globby from 'globby'
import { deepEqual } from 'fast-equals'
import { printDatabaseStepsOverview } from './utils/printDatabaseSteps'
import { printMigrationReadme } from './utils/printMigrationReadme'
import { printDatamodelDiff } from './utils/printDatamodelDiff'
import chalk from 'chalk'
import { highlightDatamodel, blue } from './utils/highlightDatamodel'
import { groupBy } from './utils/groupBy'
import { exampleDbSteps } from './example-db-steps'
import stripAnsi from 'strip-ansi'
import Charm from './utils/charm'
import { formatms } from './utils/formartms'

const readFile = promisify(fs.readFile)
const exists = promisify(fs.exists)

export type UpOptions = {
  preview?: boolean
  n?: number
  short?: boolean
}
const brightGreen = chalk.rgb(127, 224, 152)
const charm = Charm()
charm.pipe(process.stdout)

export class Lift {
  engine: LiftEngine
  constructor(protected projectDir: string) {
    this.engine = new LiftEngine({ projectDir })
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

    // TODO better printing of params
    const nameStr = name ? ` --name ${chalk.bold(name)}` : ''
    const previewStr = preview ? ` --preview` : ''
    console.log(`🏋️‍ lift create${nameStr}${previewStr}`)
    if (lastDatamodel) {
      const wording = preview
        ? `Potential datamodel changes:`
        : 'Datamodel Changes:'
      console.log(chalk.bold(`\n${wording}\n`))
    } else {
      console.log(brightGreen.bold('\nNew datamodel:\n'))
    }
    if (lastDatamodel) {
      console.log(printDatamodelDiff(lastDatamodel, datamodel))
    } else {
      console.log(highlightDatamodel(datamodel))
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
          databaseSteps,
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
    datamodelFiles.sort()
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
    const migrationSteps = await globby(
      ['**/steps.json', '**/datamodel.prisma'],
      {
        cwd: migrationsDir,
      },
    ).then(files =>
      Promise.all(
        files.map(async fileName => ({
          fileName: fileName.split('/')[1],
          migrationId: fileName.split('/')[0],
          file: await readFile(path.join(migrationsDir, fileName), 'utf-8'),
        })),
      ),
    )

    migrationSteps.sort((a, b) => (a.migrationId < b.migrationId ? -1 : 1))

    const groupedByMigration = groupBy(migrationSteps, step => step.migrationId)

    return Object.entries(groupedByMigration).map(([migrationId, files]) => {
      const stepsFile = files.find(f => f.fileName === 'steps.json')!
      const datamodelFile = files.find(f => f.fileName === 'datamodel.prisma')!
      return {
        id: migrationId,
        steps: JSON.parse(stepsFile.file),
        datamodel: datamodelFile.file,
      }
    })
  }

  public async up({ n, preview, short }: UpOptions): Promise<string> {
    const before = Date.now()
    const localMigrations = await this.getLocalMigrations()
    const remoteMigrations = await this.engine.listMigrations()
    if (remoteMigrations.length > localMigrations.length) {
      throw new Error(
        `There are more migrations in the database than locally. This must not happen`,
      )
    }

    let lastAppliedIndex = -1
    let migrationsToApply = localMigrations.filter((localMigration, index) => {
      const remoteMigration = remoteMigrations[index]
      // if there is already a corresponding remote migration,
      // we don't need to apply this migration

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
        lastAppliedIndex = index
        return false
      }
      return true
    })

    if (typeof n === 'number') {
      migrationsToApply = migrationsToApply.slice(0, n)
    }

    if (!short) {
      const previewStr = preview ? ` --preview` : ''
      console.log(`🏋️‍ lift up${previewStr}\n`)

      if (migrationsToApply.length === 0) {
        return 'All migrations are already applied'
      }

      const lastAppliedMigration: Migration | undefined =
        lastAppliedIndex > -1 ? localMigrations[lastAppliedIndex] : undefined
      const lastUnappliedMigration: Migration = migrationsToApply.slice(-1)[0]

      if (lastAppliedMigration) {
        console.log(chalk.bold('Changes to be applied:'))
        console.log(
          printDatamodelDiff(
            lastAppliedMigration.datamodel,
            lastUnappliedMigration.datamodel,
          ),
        )
      } else {
        console.log(
          brightGreen.bold('Datamodel that will initialize the db:\n'),
        )
        console.log(highlightDatamodel(lastUnappliedMigration.datamodel))
      }
    }

    const progressRenderer = new ProgressRenderer(migrationsToApply)

    progressRenderer.render()

    if (preview) {
      return `To apply the migrations, run ${chalk.greenBright(
        'prisma lift up',
      )}\n`
    }

    for (let i = 0; i < migrationsToApply.length; i++) {
      const { id, steps } = migrationsToApply[i]
      const result = await this.engine.applyMigration({
        force: false,
        migrationId: id,
        steps: steps,
      })
      const totalSteps = result.databaseSteps.length
      let progress: EngineResults.MigrationProgress | undefined
      progressLoop: while (
        (progress = await this.engine.migrationProgess({
          migrationId: id,
        }))
      ) {
        if (progress.status === 'InProgress') {
          progressRenderer.setProgress(i, progress.applied / totalSteps)
        }
        if (progress.status === 'Success') {
          progressRenderer.setProgress(i, 1)
          break progressLoop
        }
        if (progress.status === 'RollbackSuccess') {
          charm.cursor(true)
          throw new Error(`Rolled back migration. ${JSON.stringify(progress)}`)
        }
        if (progress.status === 'RollbackFailure') {
          charm.cursor(true)
          throw new Error(
            `Failed to roll back migration. ${JSON.stringify(progress)}`,
          )
        }
        await new Promise(r => setTimeout(r, 20))
      }
    }
    await progressRenderer.done()
    return `\n🚀  Done with ${migrationsToApply.length} migration${
      migrationsToApply.length > 1 ? 's' : ''
    } in ${formatms(Date.now() - before)}.\n`
  }
}

class ProgressRenderer {
  currentIndex = 0
  currentProgress = 0
  zeroPosition = 0
  constructor(private readonly migrations: Migration[]) {}

  setProgress(index: number, progressPercentage: number) {
    const width = 6
    const progress = Math.min(Math.floor(progressPercentage * width), width)
    if (index > this.currentIndex) {
      ;(<any>process.stdout).cursorTo(this.zeroPosition)
      this.currentProgress = 0
      charm.down(1)
    }
    if (progress > this.currentProgress) {
      // TODO: If I have time, render the Done Rocket
      // if (progress === width) {
      //   // charm.left(6)
      //   ;(<any>process.stdout).cursorTo(this.zeroPosition)
      //   await new Promise(r => setTimeout(r, 100))
      //   const doneText = `Done 🚀`
      //   process.stdout.write(doneText)
      //   await new Promise(r => setTimeout(r, 100))
      //   ;(<any>process.stdout).cursorTo(this.zeroPosition)
      //   await new Promise(r => setTimeout(r, 100))
      //   // charm.position(this.zeroPosition)
      // } else {
      process.stdout.write('\u25A0'.repeat(progress - this.currentProgress))
      // }
    }
    // console.log(this.currentIndex, this.currentProgress)

    this.currentIndex = index
    this.currentProgress = progress
  }

  render() {
    charm.cursor(false)
    const longestMigration = this.migrations.reduce(
      (acc, curr) => Math.max(curr.id.length, acc),
      0,
    )
    let maxStepLength = 0
    const rows = this.migrations
      .map(m => {
        const steps = printDatabaseStepsOverview(exampleDbSteps)
        maxStepLength = Math.max(stripAnsi(steps).length, maxStepLength)
        return `${blue(m.id)}${' '.repeat(
          longestMigration - m.id.length + 2,
        )}${steps}`
      })
      .join('\n')

    const column1 = 'Migration'
    const column2 = 'Database actions'
    const column3 = 'Status'
    const header =
      chalk.underline(column1) +
      ' '.repeat(longestMigration - column1.length) +
      '  ' +
      chalk.underline(column2) +
      ' '.repeat(maxStepLength - column2.length + 2) +
      chalk.underline(column3) +
      '\n\n'

    const changeOverview = header + rows

    console.log(chalk.bold('\nDatabase Changes:\n'))
    console.log(changeOverview)
    console.log(
      chalk.dim(
        `\nYou can get the detailed db changes with ${chalk.greenBright(
          'prisma lift up --verbose',
        )}\nOr read about them in the ./migrations/MIGRATION_ID/README.md`,
      ),
    )

    charm.up(this.migrations.length + 3)
    this.zeroPosition = longestMigration + maxStepLength + 4
    charm.right(this.zeroPosition)
  }

  async done() {
    await new Promise(r => setTimeout(r, 50))
    charm.cursor(true)
    charm.down(4)
    ;(<any>process.stdout).cursorTo(0)
  }
}
