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
  DatamodelStep,
  DatabaseStep,
} from './types'
import {
  deserializeLockFile,
  initLockFile,
  serializeLockFile,
} from './utils/LockFile'
import globby from 'globby'
import {
  printDatabaseStepsOverview,
  highlightMigrationsSQL,
} from './utils/printDatabaseSteps'
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
import { Hooks } from './cli/commands/LiftWatch'
import { watchMigrationName } from './utils/constants'
import { deepEqual } from 'fast-equals'
import debugLib from 'debug'
import { findLast } from './utils/findLast'
const packageJson = require('../package.json')
const debug = debugLib('Lift')

const readFile = promisify(fs.readFile)
const exists = promisify(fs.exists)

export type UpOptions = {
  preview?: boolean
  n?: number
  short?: boolean
  verbose?: boolean
}
export type DownOptions = {
  n?: number
}
export type WatchOptions = {
  preview?: boolean
  hooks?: Hooks
  clear?: boolean
}
const brightGreen = chalk.rgb(127, 224, 152)

export class Lift {
  engine: LiftEngine
  private datamodelBeforeWatch?: string
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
      const lockFile = deserializeLockFile(file)
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
      return lockFile
    }

    return initLockFile()
  }

  public async createMigration(
    migrationId: string,
  ): Promise<MigrationWithDatabaseSteps | undefined> {
    const datamodel = await this.getDatamodel()
    const {
      localMigrations,
      migrationsToApply,
    } = await this.getMigrationsToApply()
    const remoteMigrations = await this.engine.listAppliedMigrations()

    const localSteps = localMigrations.flatMap(m => m.datamodelSteps)

    const result = await this.engine.inferMigrationSteps({
      dataModel: datamodel,
      migrationId,
      assumeToBeApplied: localSteps,
    })

    let datamodelSteps: DatamodelStep[] = []
    let databaseSteps: DatabaseStep[] = []

    if (
      /**
       * this is crucial to support more local unapplied migrations
       * after a local unapplied watch-surplus migration
       */
      migrationsToApply.length === 0 &&
      remoteMigrations.length > 0 &&
      remoteMigrations[remoteMigrations.length - 1].id === watchMigrationName
    ) {
      /**
       * In this case we rely on a special implementation in the migration engine:
       * If we send "applyMigration" with exactly the same steps as the last applied migration,
       * while the last applied migration is called "watch", the migration engine will just rename that migration
       */
      const watchMigration = remoteMigrations[remoteMigrations.length - 1]
      const lastLocalMigration =
        localMigrations.length > 0
          ? localMigrations[localMigrations.length - 1]
          : undefined
      if (lastLocalMigration) {
        if (
          deepEqual(
            lastLocalMigration.datamodelSteps,
            watchMigration.datamodelSteps,
          )
        ) {
          return undefined
        }
      }
      datamodelSteps = watchMigration.datamodelSteps.concat(
        result.datamodelSteps,
      )
      databaseSteps = watchMigration.databaseSteps.concat(result.databaseSteps)
      // TODO: the database steps are empty for now, but Marcus adds that to the migration engine
    } else {
      datamodelSteps = result.datamodelSteps
      databaseSteps = result.databaseSteps
    }

    if (datamodelSteps.length === 0) {
      return undefined
    }

    return {
      id: migrationId,
      datamodel,
      datamodelSteps,
      databaseSteps,
    }
  }

  public async create(
    name?: string,
    preview?: boolean,
  ): Promise<
    { files: FileMap; migrationId: string; newLockFile: string } | undefined
  > {
    const lockFile = await this.getLockFile()
    const timestamp = now()
    const migrationId = timestamp + (name ? `-${name}` : '')
    const migration = await this.createMigration(migrationId)
    if (!migration) {
      return undefined
    }
    const { datamodel, datamodelSteps, databaseSteps } = migration
    const lastDatamodel = await this.getLastDatamodel()

    // TODO better printing of params
    const nameStr = name ? ` --name ${chalk.bold(name)}` : ''
    const previewStr = preview ? ` --preview` : ''
    console.log(`🏋️‍  lift create${nameStr}${previewStr}`)
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
    localMigrations: Migration[],
    fromIndex: number,
    remoteMigrations: EngineResults.StoredMigration[],
  ): Promise<MigrationWithDatabaseSteps[]> {
    const lastRemoteMigration = remoteMigrations[remoteMigrations.length - 1]
    const migrationsWithDatabaseSteps = await pMap(
      localMigrations,
      async (migration, index) => {
        if (index < fromIndex) {
          return {
            ...migration,
            databaseSteps: [],
          }
        }
        if (
          index === fromIndex &&
          lastRemoteMigration &&
          lastRemoteMigration.id === watchMigrationName
        ) {
          return {
            ...migration,
            databaseSteps: lastRemoteMigration.databaseSteps,
          }
        }
        const stepsUntilNow =
          index > 0
            ? localMigrations.slice(0, index).flatMap(m => m.datamodelSteps)
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

    return migrationsWithDatabaseSteps.slice(fromIndex)
  }

  public async watch(
    options: WatchOptions = { preview: false, clear: true },
  ): Promise<string> {
    if (!options.clear) {
      options.clear = true
    }
    fs.watch(
      path.join(this.projectDir, 'datamodel.prisma'),
      (eventType, filename) => {
        if (eventType === 'change') {
          this.watchUp(options)
        }
      },
    )
    const {
      migrationsToApply,
      appliedRemoteMigrations,
    } = await this.getMigrationsToApply()

    const lastNonWatchMigration = findLast(
      appliedRemoteMigrations,
      m => m.id !== 'watch',
    )

    if (lastNonWatchMigration) {
      this.datamodelBeforeWatch = lastNonWatchMigration.datamodel
    } else {
      this.datamodelBeforeWatch = ''
    }

    if (migrationsToApply.length > 0) {
      // TODO: Ask for permission if we actually want to do it?
      const before = Date.now()
      console.log(
        `Applying unapplied migrations ${chalk.blue(
          migrationsToApply.map(m => m.id).join(', '),
        )}\n`,
      )
      await this.up({
        short: true,
      })
      console.log(
        `Done applying migrations in ${formatms(Date.now() - before)}`,
      )
      options.clear = false
    }

    this.watchUp(options)
    return ''
  }

  async watchUp({ preview, hooks, clear }: WatchOptions = { clear: true }) {
    if (clear) {
      console.clear()
    }
    console.log(`🏋️‍  Watching for changes in datamodel.prisma`)
    try {
      if (preview)
        return `\nWatching for changes in ${chalk.greenBright(
          'datamodel.prisma',
        )}`

      if (preview)
        return `\nRun ${chalk.greenBright(
          'prisma lift create --name MIGRATION_NAME',
        )} to create the migration\n`

      const remoteMigrations = await this.engine.listAppliedMigrations()
      const lastMigration = remoteMigrations.slice(-1)[0]
      if (lastMigration && lastMigration.id === watchMigrationName) {
        const unapplyResult = await this.engine.unapplyMigration()
      }
      const migration = await this.createMigration(watchMigrationName)
      if (!migration) {
        return 'Everything up-to-date'
      }

      const before = Date.now()
      await this.engine.applyMigration({
        force: true,
        migrationId: migration.id,
        steps: migration.datamodelSteps,
      })

      const newAppliedRemoteMigrations = await this.engine.listAppliedMigrations()

      if (this.datamodelBeforeWatch) {
        console.log(`Changes since last ${chalk.bold('prisma lift create')}\n`)
        console.log(
          printDatamodelDiff(
            this.datamodelBeforeWatch,
            newAppliedRemoteMigrations[newAppliedRemoteMigrations.length - 1]
              .datamodel,
          ),
        )
        console.log(`\nApplied Migration in ${formatms(Date.now() - before)}`)
      }

      if (hooks && hooks.afterUp) {
        hooks.afterUp()
      }
    } catch (e) {
      console.error(e)
    }
  }

  public async down({ n }: DownOptions): Promise<string> {
    await this.getLockFile()
    const before = Date.now()
    const localMigrations = await this.getLocalMigrations()
    const appliedRemoteMigrations = await this.engine.listAppliedMigrations()

    // TODO cleanup
    let lastAppliedIndex = -1
    const appliedMigrations = localMigrations.filter(
      (localMigration, index) => {
        const remoteMigration = appliedRemoteMigrations[index]
        // if there is already a corresponding remote migration,
        // we don't need to apply this migration

        if (remoteMigration) {
          if (
            localMigration.id !== remoteMigration.id &&
            remoteMigration.id !== watchMigrationName // it's fine to have the watch migration remotely
          ) {
            throw new Error(
              `Local and remote migrations are not in lockstep. We have migration ${
                localMigration.id
              } locally and ${
                remoteMigration.id
              } remotely at the same position in the history.`,
            )
          }
          lastAppliedIndex = index
          return true
        }
        return false
      },
    )

    if (lastAppliedIndex === -1) {
      return 'No migration to roll back'
    }

    if (n && n > appliedMigrations.length) {
      throw new Error(
        `You provided ${chalk.redBright(
          `n = ${chalk.bold(String(n))}`,
        )}, but there are only ${
          appliedMigrations.length
        } applied migrations that can be rolled back. Please provide ${chalk.green(
          String(appliedMigrations.length),
        )} or lower.`,
      )
    }

    n = n || 1

    for (let i = 0; i < n; i++) {
      const lastApplied = localMigrations[lastAppliedIndex]
      console.log(`Rolling back migration ${blue(lastApplied.id)}`)

      const result = await this.engine.unapplyMigration()

      if (result.errors && result.errors.length > 0) {
        throw new Error(
          `Errors during rollback: ${JSON.stringify(result.errors)}`,
        )
      }

      lastAppliedIndex--
    }

    return `🚀 Done with ${chalk.bold('down')} in ${formatms(
      Date.now() - before,
    )}`
  }

  private async getMigrationsToApply(): Promise<{
    localMigrations: Migration[]
    lastAppliedIndex: number
    migrationsToApply: Migration[]
    appliedRemoteMigrations: EngineResults.StoredMigration[]
  }> {
    const localMigrations = await this.getLocalMigrations()
    const appliedRemoteMigrations = await this.engine.listAppliedMigrations()
    const appliedRemoteMigrationsWithoutWatch = appliedRemoteMigrations.filter(
      m => m.id !== watchMigrationName,
    )

    if (appliedRemoteMigrationsWithoutWatch.length > localMigrations.length) {
      const localMigrationIds = localMigrations.map(m => m.id)
      const remoteMigrationIds = appliedRemoteMigrationsWithoutWatch.map(
        m => m.id,
      )

      throw new Error(
        `There are more migrations in the database than locally. This must not happen. Local migration ids: ${localMigrationIds.join(
          ', ',
        )}. Remote migration ids: ${remoteMigrationIds.join(', ')}`,
      )
    }

    let lastAppliedIndex = -1
    const migrationsToApply = localMigrations.filter(
      (localMigration, index) => {
        const remoteMigration = appliedRemoteMigrations[index]
        // if there is already a corresponding remote migration,
        // we don't need to apply this migration

        if (remoteMigration) {
          if (
            localMigration.id !== remoteMigration.id &&
            remoteMigration.id !== watchMigrationName
          ) {
            throw new Error(
              `Local and remote migrations are not in lockstep. We have migration ${
                localMigration.id
              } locally and ${
                remoteMigration.id
              } remotely at the same position in the history.`,
            )
          }
          // if the current remote migration we're looking at is a watch migration,
          // we still want to "over apply" it
          if (remoteMigration.id !== watchMigrationName) {
            lastAppliedIndex = index
            return false
          }
        }
        return true
      },
    )

    return {
      localMigrations,
      lastAppliedIndex,
      migrationsToApply,
      appliedRemoteMigrations,
    }
  }

  public async up({ n, preview, short, verbose }: UpOptions = {}): Promise<
    string
  > {
    await this.getLockFile()
    const before = Date.now()

    const migrationsToApplyResult = await this.getMigrationsToApply()
    const {
      lastAppliedIndex,
      localMigrations,
      appliedRemoteMigrations,
    } = migrationsToApplyResult
    let { migrationsToApply } = migrationsToApplyResult

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
      appliedRemoteMigrations,
    )

    // The case we're checking for: After `watch`, there may have been additional changes to the datamodel,
    // which are now included in the first unapplied migration
    // This will be much better in the future (maybe before, maybe after Prisma Day),
    // we'll not just unapply the last watch migration, but rather make sure that we append the difference

    const lastAppliedRemoteMigration =
      appliedRemoteMigrations[appliedRemoteMigrations.length - 1]
    if (
      lastAppliedRemoteMigration &&
      lastAppliedRemoteMigration.id === watchMigrationName
    ) {
      const firstUnappliedMigration = migrationsToApply[0]
      if (
        !deepEqual(
          firstUnappliedMigration.datamodelSteps,
          lastAppliedRemoteMigration.datamodelSteps,
        )
      ) {
        try {
          await this.engine.unapplyMigration()
        } catch (e) {
          debug(e)
        }
      }
    }

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
      // and for verbose printing
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

    if (verbose) {
      console.log(chalk.bold(`\nSQL Commands:\n`))
      console.log(highlightMigrationsSQL(migrationsWithDbSteps))
      console.log('\n')
    }

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
      ' '.repeat(Math.max(0, maxMigrationLength - column1.length)) +
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
