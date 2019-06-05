import { LiftEngine } from './LiftEngine'
import fs from 'fs'
import path from 'path'
import { now } from './utils/now'
import { promisify } from 'util'
import {
  FileMap,
  LockFile,
  Migration,
  EngineResults,
  MigrationWithDatabaseSteps,
} from './types'
import {
  deserializeLockFile,
  initLockFile,
  serializeLockFile,
} from './utils/LockFile'
import globby from 'globby'
import { printDatabaseStepsOverview } from './utils/printDatabaseSteps'
import { printMigrationReadme } from './utils/printMigrationReadme'
import { printDatamodelDiff } from './utils/printDatamodelDiff'
import chalk from 'chalk'
import { highlightDatamodel } from './cli/highlight/highlight'
import { groupBy } from './utils/groupBy'
import stripAnsi from 'strip-ansi'
import cliCursor from 'cli-cursor'
import { formatms } from './utils/formartms'
import { blue } from './cli/highlight/theme'
import logUpdate from 'log-update'
import { Readable } from 'stream'
import { drawBox } from './utils/drawBox'
import pMap from 'p-map'
const packageJson = require('../package.json')

const readFile = promisify(fs.readFile)
const exists = promisify(fs.exists)

export type UpOptions = {
  preview?: boolean
  n?: number
  short?: boolean
}
export type DownOptions = {
  n?: number
}
const brightGreen = chalk.rgb(127, 224, 152)

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
    const localMigrations = await this.getLocalMigrations()

    const localSteps = localMigrations.flatMap(m => m.datamodelSteps)

    const result = await this.engine.inferMigrationSteps({
      dataModel: datamodel,
      migrationId,
      assumeToBeApplied: localSteps,
    })

    const { datamodelSteps, databaseSteps } = result
    if (datamodelSteps.length === 0) {
      return undefined
    }

    // TODO better printing of params
    const nameStr = name ? ` --name ${chalk.bold(name)}` : ''
    const previewStr = preview ? ` --preview` : ''
    console.log(`🏋️‍ lift create${nameStr}${previewStr}`)
    if (lastDatamodel) {
      const wording = preview
        ? `Potential datamodel changes:`
        : 'Local datamodel Changes:'
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

    const { version } = packageJson

    return {
      migrationId,
      files: {
        ['steps.json']: JSON.stringify(
          { version, steps: datamodelSteps },
          null,
          2,
        ),
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
    if (datamodelFiles.length === 0) {
      return undefined
    }
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
      const stepsFileJson = JSON.parse(stepsFile.file)
      if (Array.isArray(stepsFileJson)) {
        throw new Error(
          `We changed the steps.json format - please delete your migrations folder and run prisma lift create again`,
        )
      }
      if (!stepsFileJson.steps) {
        throw new Error(
          `${stepsFile.fileName} is expected to have a .steps property`,
        )
      }

      return {
        id: migrationId,
        datamodelSteps: stepsFileJson.steps,
        datamodel: datamodelFile.file,
      }
    })
  }

  private async getDatabaseSteps(
    migrations: Migration[],
    fromIndex: number,
  ): Promise<MigrationWithDatabaseSteps[]> {
    const migrationsWithDatabaseSteps = await pMap(
      migrations,
      async (migration, index) => {
        if (index < fromIndex) {
          return {
            ...migration,
            databaseSteps: [],
          }
        }
        const stepsUntilNow =
          index > 0
            ? migrations.slice(0, index).flatMap(m => m.datamodelSteps)
            : []
        const input = {
          assumeToBeApplied: stepsUntilNow,
          stepsToApply: migration.datamodelSteps,
        }
        const { databaseSteps } = await this.engine.calculateDatabaseSteps(
          input,
        )
        return {
          ...migration,
          databaseSteps,
        }
      },
      { concurrency: 1 },
    )

    return migrationsWithDatabaseSteps.filter(m => m.databaseSteps.length > 0)
  }

  public async down({ n }: DownOptions): Promise<string> {
    const before = Date.now()
    const localMigrations = await this.getLocalMigrations()
    const allRemoteMigrations = await this.engine.listMigrations()
    const appliedRemoteMigrations = allRemoteMigrations.filter(
      m => m.status === 'Success',
    )

    // TODO cleanup
    let lastAppliedIndex = -1
    localMigrations.forEach((localMigration, index) => {
      const remoteMigration = appliedRemoteMigrations[index]
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
      }
    })

    if (lastAppliedIndex === -1) {
      return 'No migration to roll back'
    }

    const lastApplied = localMigrations[lastAppliedIndex]
    console.log(`Rolling back migration ${blue(lastApplied.id)}`)

    const result = await this.engine.unapplyMigration()

    if (result.errors && result.errors.length > 0) {
      throw new Error(
        `Errors during rollback: ${JSON.stringify(result.errors)}`,
      )
    }

    return `🚀 Done with ${chalk.bold('down')} in ${formatms(
      Date.now() - before,
    )}`
  }

  public async up({ n, preview, short }: UpOptions): Promise<string> {
    const before = Date.now()
    const localMigrations = await this.getLocalMigrations()
    const allRemoteMigrations = await this.engine.listMigrations()
    const appliedRemoteMigrations = allRemoteMigrations.filter(
      m => m.status === 'Success',
    )

    if (appliedRemoteMigrations.length > localMigrations.length) {
      throw new Error(
        `There are more migrations in the database than locally. This must not happen`,
      )
    }

    let lastAppliedIndex = -1
    let migrationsToApply = localMigrations.filter((localMigration, index) => {
      const remoteMigration = appliedRemoteMigrations[index]
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

    const firstMigrationToApplyIndex = localMigrations.indexOf(
      migrationsToApply[0],
    )
    const migrationsWithDbSteps = await this.getDatabaseSteps(
      localMigrations,
      firstMigrationToApplyIndex,
    )

    const progressRenderer = new ProgressRenderer(migrationsWithDbSteps)

    progressRenderer.render()

    if (preview) {
      await progressRenderer.done()
      return `\nTo apply the migrations, run ${chalk.greenBright(
        'prisma lift up',
      )}\n`
    }

    for (let i = 0; i < migrationsToApply.length; i++) {
      const { id, datamodelSteps } = migrationsToApply[i]
      const result = await this.engine.applyMigration({
        force: false,
        migrationId: id,
        steps: datamodelSteps,
      })
      // needed for the ProgressRenderer
      migrationsWithDbSteps[i].databaseSteps = result.databaseSteps
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
          cliCursor.show()
          throw new Error(`Rolled back migration. ${JSON.stringify(progress)}`)
        }
        if (progress.status === 'RollbackFailure') {
          cliCursor.show()
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
  private currentIndex = 0
  private currentProgress = 0
  private statusWidth = 6
  private logsString = ''
  private logsName?: string
  constructor(private migrations: MigrationWithDatabaseSteps[]) {
    cliCursor.hide()
  }

  setMigrations(migrations: MigrationWithDatabaseSteps[]) {
    this.migrations = migrations
    this.render()
  }

  setProgress(index: number, progressPercentage: number) {
    const progress = Math.min(
      Math.floor(progressPercentage * this.statusWidth),
      this.statusWidth,
    )

    this.currentIndex = index
    this.currentProgress = progress
    this.render()
  }

  showLogs(name, stream: Readable) {
    this.logsName = name
    this.logsString = ''
    stream.on('data', data => {
      this.logsString += data.toString()
      this.render()
    })
  }

  render() {
    const maxMigrationLength = this.migrations.reduce(
      (acc, curr) => Math.max(curr.id.length, acc),
      0,
    )
    let maxStepLength = 0
    //   const scripts = `
    // └─ before.sh
    // └─ ${blue('Datamodel migration')}
    // └─ after.sh`
    const rows = this.migrations
      .map(m => {
        const steps = printDatabaseStepsOverview(m.databaseSteps)
        maxStepLength = Math.max(stripAnsi(steps).length, maxStepLength)
        return `${blue(m.id)}${' '.repeat(
          maxMigrationLength - m.id.length + 2,
        )}${steps}`
      })
      .map((m, index) => {
        const maxLength = maxStepLength + maxMigrationLength
        const paddingLeft = maxLength - stripAnsi(m).length + 2
        let newLine = m + ' '.repeat(paddingLeft) + '  '
        if (
          this.currentIndex > index ||
          (this.currentIndex === index &&
            this.currentProgress === this.statusWidth)
        ) {
          return newLine + 'Done 🚀' //+ scripts
        } else if (this.currentIndex === index) {
          return newLine + '\u25A0'.repeat(this.currentProgress) //+ scripts
        }

        return newLine
      })
      .join('\n')

    const column1 = 'Migration'
    const column2 = 'Database actions'
    const column3 = 'Status'
    const header =
      chalk.underline(column1) +
      ' '.repeat(maxMigrationLength - column1.length) +
      '  ' +
      chalk.underline(column2) +
      ' '.repeat(Math.max(0, maxStepLength - column2.length + 2)) +
      chalk.underline(column3) +
      '\n\n'

    const changeOverview = header + rows

    let str = ''
    str += chalk.bold('\nDatabase Changes:\n\n')
    str += changeOverview

    str += chalk.dim(
      `\n\nYou can get the detailed db changes with ${chalk.greenBright(
        'prisma lift up --verbose',
      )}\nOr read about them in the ./migrations/MIGRATION_ID/README.md`,
    )

    if (this.logsName && this.logsString.length > 0) {
      str +=
        '\n\n' +
        drawBox({
          height: Math.min(15, process.stdout.rows || 15),
          width: process.stdout.columns || 40,
          str: this.logsString,
          title: this.logsName,
        }) +
        '\n'
    }

    logUpdate(str)
  }

  async done() {
    cliCursor.show()
  }
}
