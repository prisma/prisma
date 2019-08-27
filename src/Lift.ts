import { Dictionary, GeneratorDefinitionWithPackage } from '@prisma/cli'
import { getPlatform } from '@prisma/get-platform'
import { getCompiledGenerators } from '@prisma/photon'
import 'array-flat-polyfill'
import chalk from 'chalk'
import cliCursor from 'cli-cursor'
import dashify from 'dashify'
import del from 'del'
import fs from 'fs'
import getPort from 'get-port'
import globby from 'globby'
import logUpdate from 'log-update'
import makeDir = require('make-dir')
import pMap from 'p-map'
import path from 'path'
import { Readable } from 'stream'
import stripAnsi from 'strip-ansi'
import { promisify } from 'util'
import { highlightDatamodel } from './cli/highlight/highlight'
import { blue } from './cli/highlight/theme'
import { DevComponentRenderer } from './ink/DevComponentRenderer'
import { LiftEngine } from './LiftEngine'
import { EngineResults, FileMap, LocalMigration, LocalMigrationWithDatabaseSteps, LockFile, Migration } from './types'
import { drawBox } from './utils/drawBox'
import { formatms } from './utils/formartms'
import { groupBy } from './utils/groupBy'
import { isWatchMigrationName } from './utils/isWatchMigrationName'
import { deserializeLockFile, initLockFile, serializeLockFile } from './utils/LockFile'
import { now, timestampToDate } from './utils/now'
import { highlightMigrationsSQL, printDatabaseStepsOverview } from './utils/printDatabaseSteps'
import { printDatamodelDiff } from './utils/printDatamodelDiff'
import { printMigrationReadme } from './utils/printMigrationReadme'
import { serializeFileMap } from './utils/serializeFileMap'
import { simpleDebounce } from './utils/simpleDebounce'
const packageJson = require('../package.json')
import { spawn } from 'child_process'
import debugLib from 'debug'
import indent from 'indent-string'
import plusX from './utils/plusX'
const debug = debugLib('Lift')

const readFile = promisify(fs.readFile)
const exists = promisify(fs.exists)

export interface UpOptions {
  preview?: boolean
  n?: number
  short?: boolean
  verbose?: boolean
}
export interface DownOptions {
  n?: number
}
export interface WatchOptions {
  preview?: boolean
  generatorDefinitions: Dictionary<GeneratorDefinitionWithPackage>
  clear?: boolean
}
interface MigrationFileMapOptions {
  migration: LocalMigrationWithDatabaseSteps
  lastMigration?: Migration
}
const brightGreen = chalk.rgb(127, 224, 152)

export class Lift {
  get devMigrationsDir() {
    return path.join(this.projectDir, 'migrations/dev')
  }
  public engine: LiftEngine

  // tslint:disable
  public watchUp = simpleDebounce(
    async (
      { preview, generatorDefinitions, clear }: WatchOptions = { clear: true, generatorDefinitions: {} },
      renderer?: DevComponentRenderer,
    ) => {
      renderer && renderer.setState({ error: undefined })
      const datamodel = await this.getDatamodel()
      try {
        const watchMigrationName = `watch-${now()}`
        const migration = await this.createMigration(watchMigrationName)
        const existingWatchMigrations = await this.getLocalWatchMigrations()

        if (migration) {
          const before = Date.now()
          renderer && renderer.setState({ lastChanged: new Date() })
          renderer && renderer.setState({ migrating: true })
          await this.engine.applyMigration({
            force: true,
            migrationId: migration.id,
            steps: migration.datamodelSteps,
            sourceConfig: datamodel,
          })
          const lastWatchMigration =
            existingWatchMigrations.length > 0 ? existingWatchMigrations[existingWatchMigrations.length - 1] : undefined

          await this.persistWatchMigration({ migration, lastMigration: lastWatchMigration })
          const after = Date.now()
          renderer && renderer.setState({ migrating: false, migratedIn: after - before })
          if (renderer) {
            this.recreateStudioServer(datamodel)
          }
        }

        if (datamodel !== this.datamodelBeforeWatch) {
          renderer &&
            renderer.setState({
              datamodelBefore: this.datamodelBeforeWatch,
              datamodelAfter: datamodel,
            })
        }

        const generators = await getCompiledGenerators(this.projectDir, datamodel, generatorDefinitions)

        const newGenerators = generators.map(gen => ({
          name: gen.prettyName || 'Generator',
          generatedIn: undefined,
          generating: false,
        }))

        const addedGenerators = newGenerators.filter(
          g => renderer && !renderer.state.generators.some(gg => gg.name === g.name),
        )
        const removedGenerators =
          (renderer && renderer.state.generators.filter(g => newGenerators.some(gg => gg.name === g.name))) || []

        if (
          (renderer && renderer.state.generators.length !== newGenerators.length) ||
          addedGenerators.length > 0 ||
          removedGenerators.length > 0
        ) {
          renderer && renderer.setState({ generators: newGenerators })
        }

        for (let i = 0; i < generators.length; i++) {
          const generator = generators[i]
          const before = Date.now()
          renderer &&
            renderer.setGeneratorState(i, {
              generating: true,
            })
          try {
            await generator.generate()
            const after = Date.now()
            renderer &&
              renderer.setGeneratorState(i, {
                generating: false,
                generatedIn: after - before,
              })
          } catch (error) {
            renderer && renderer.setState({ error })
          }
        }
      } catch (error) {
        renderer && renderer.setState({ error })
      }
    },
  )
  // tsline:enable
  private datamodelBeforeWatch: string = ''
  private studioServer?: any
  private studioPort: number = 5555
  constructor(protected projectDir: string) {
    const schemaPath = this.getDatamodelPath()
    this.engine = new LiftEngine({ projectDir, schemaPath })
  }

  public getDatamodelPath(): string {
    const datamodelPath = path.resolve(this.projectDir, 'schema.prisma')
    if (!fs.existsSync(datamodelPath)) {
      throw new Error(`Could not find ${datamodelPath}`)
    }

    return datamodelPath
  }

  public getDatamodel(): string {
    return fs.readFileSync(this.getDatamodelPath(), 'utf-8')
  }

  // TODO: optimize datapaths, where we have a datamodel already, use it
  public getSourceConfig(): string {
    return this.getDatamodel()
  }

  public async recreateStudioServer(datamodel: string) {
    try {
      if (this.studioServer) {
        this.studioServer.restart({ datamodel })
        return
      }

      const platform = await getPlatform()

      const pathCandidates = [
        // ncc go home
        // tslint:disable-next-line
        eval(`require('path').join(__dirname, '../node_modules/@prisma/photon/query-engine-${platform}')`), // for local dev
        // tslint:disable-next-line
        eval(`require('path').join(__dirname, '../query-engine-${platform}')`), // for production
      ]

      const pathsExist = await Promise.all(
        pathCandidates.map(async candidate => ({ exists: await exists(candidate), path: candidate })),
      )

      const firstExistingPath = pathsExist.find(p => p.exists)

      if (!firstExistingPath) {
        throw new Error(`Could not find any binary path for Studio. Looked in ${pathCandidates.join(', ')}`)
      }

      const StudioServer = require('@prisma/studio-server').default

      this.studioServer = new StudioServer({
        port: this.studioPort,
        debug: false,
        datamodel,
        binaryPath: firstExistingPath.path,
      })

      await this.studioServer.start()
    } catch (e) {
      debug(e)
    }
  }

  public async getLockFile(): Promise<LockFile> {
    const lockFilePath = path.resolve(this.projectDir, 'migrations', 'lift.lock')
    if (await exists(lockFilePath)) {
      const file = await readFile(lockFilePath, 'utf-8')
      const lockFile = deserializeLockFile(file)
      if (lockFile.remoteBranch) {
        // TODO: Implement handling the conflict
        throw new Error(
          `There's a merge conflict in the ${chalk.bold(
            'migrations/lift.lock',
          )} file. Please execute ${chalk.greenBright('prisma lift fix')} to solve it`,
        )
      }
      return lockFile
    }

    return initLockFile()
  }

  public async createMigration(migrationId: string): Promise<LocalMigrationWithDatabaseSteps | undefined> {
    const { migrationsToApply, sourceConfig } = await this.getMigrationsToApply()

    const assumeToBeApplied = migrationsToApply.flatMap(m => m.datamodelSteps)

    const datamodel = await this.getDatamodel()
    const { datamodelSteps, databaseSteps } = await this.engine.inferMigrationSteps({
      sourceConfig,
      datamodel,
      migrationId,
      assumeToBeApplied,
    })

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

  public getMigrationId(name?: string) {
    const timestamp = now()
    return timestamp + (name ? `-${dashify(name)}` : '')
  }

  public async save(
    migration: LocalMigrationWithDatabaseSteps,
    name?: string,
    preview?: boolean,
  ): Promise<{ files: FileMap; migrationId: string; newLockFile: string }> {
    const migrationId = this.getMigrationId(name)
    migration.id = migrationId
    const lockFile = await this.getLockFile()
    const { datamodel } = migration
    const localMigrations = await this.getLocalMigrations()
    const lastMigration = localMigrations.length > 0 ? localMigrations[localMigrations.length - 1] : undefined

    // TODO better printing of params
    const nameStr = name ? ` --name ${chalk.bold(name)}` : ''
    const previewStr = preview ? ` --preview` : ''
    console.log(`📼  lift save${nameStr}${previewStr}`)
    if (lastMigration) {
      const wording = preview ? `Potential datamodel changes:` : 'Local datamodel Changes:'
      console.log(chalk.bold(`\n${wording}\n`))
    } else {
      console.log(brightGreen.bold('\nNew datamodel:\n'))
    }
    if (lastMigration) {
      console.log(printDatamodelDiff(lastMigration.datamodel, datamodel))
    } else {
      console.log(highlightDatamodel(datamodel))
    }

    lockFile.localMigrations.push(migrationId)
    const newLockFile = serializeLockFile(lockFile)

    await del(this.devMigrationsDir)

    return {
      migrationId,
      files: this.getMigrationFileMap({ migration, lastMigration }),
      newLockFile,
    }
  }

  public async getLocalWatchMigrations(): Promise<Migration[]> {
    return this.getLocalMigrations(this.devMigrationsDir)
  }

  public async watch(
    options: WatchOptions = { preview: false, clear: true, generatorDefinitions: {} },
  ): Promise<string> {
    if (!options.clear) {
      options.clear = true
    }

    const datamodel = await this.getDatamodel()

    const generators = await getCompiledGenerators(this.projectDir, datamodel, options.generatorDefinitions)

    this.studioPort = await getPort({ port: getPort.makeRange(5555, 5600) })

    const datamodelPath = await this.getDatamodelPath()
    const relativeDatamodelPath = path.relative(process.cwd(), datamodelPath)

    const renderer = new DevComponentRenderer({
      port: this.studioPort,
      initialState: {
        studioPort: this.studioPort,
        datamodelBefore: this.datamodelBeforeWatch,
        datamodelAfter: datamodel,
        generators: generators.map(gen => ({
          name: gen.prettyName || 'Generator',
          generatedIn: undefined,
          generating: false,
        })),
        datamodelPath,
        migrating: false,
        migratedIn: undefined,
        lastChanged: undefined,
        relativeDatamodelPath,
      },
    })

    // silent everyone else. this is not a democracy
    console.log = (...args) => {
      debug(...args)
    }

    this.recreateStudioServer(datamodel)

    const { migrationsToApply } = await this.getMigrationsToApply()

    if (migrationsToApply.length > 0) {
      renderer.setState({ migrating: true }) // TODO: Show that this is actually applying real migrations, not just watch migrations
      // TODO: Ask for permission if we actually want to do it?
      // console.log(`Applying unapplied migrations ${chalk.blue(migrationsToApply.map(m => m.id).join(', '))}\n`)
      await this.up({
        short: true,
      })
      // console.log(`Done applying migrations in ${formatms(Date.now() - before)}`)
      options.clear = false
      renderer.setState({ migrating: false })
    }

    const localMigrations = await this.getLocalMigrations()
    const watchMigrations = await this.getLocalWatchMigrations()

    let lastChanged: undefined | Date
    if (watchMigrations.length > 0) {
      const timestamp = watchMigrations[watchMigrations.length - 1].id.split('-')[1]
      lastChanged = timestampToDate(timestamp)
    } else if (localMigrations.length > 0) {
      lastChanged = timestampToDate(localMigrations[localMigrations.length - 1].id.split('-')[0])
    }
    renderer.setState({ lastChanged })

    if (localMigrations.length > 0) {
      this.datamodelBeforeWatch = localMigrations[localMigrations.length - 1].datamodel
    }

    await makeDir(this.devMigrationsDir)

    fs.watch(await this.getDatamodelPath(), (eventType, filename) => {
      if (eventType === 'change') {
        this.watchUp(options, renderer)
      }
    })

    this.watchUp(options, renderer)
    return ''
  }

  public async down({ n }: DownOptions): Promise<string> {
    await this.getLockFile()
    const before = Date.now()
    const localMigrations = await this.getLocalMigrations()
    const localWatchMigrations = await this.getLocalWatchMigrations()
    if (localWatchMigrations.length > 0) {
      throw new Error(
        `Before running ${chalk.yellow('prisma lift down')}, please save your ${chalk.bold(
          'dev',
        )} changes using ${chalk.bold.greenBright('prisma lift create')} and ${chalk.bold.greenBright(
          'prisma2 lift up',
        )}`,
      )
    }
    const datamodel = await this.getDatamodel()
    const appliedRemoteMigrations = await this.engine.listAppliedMigrations({ sourceConfig: datamodel })

    // TODO cleanup
    let lastAppliedIndex = -1
    const appliedMigrations = localMigrations.filter((localMigration, index) => {
      const remoteMigration = appliedRemoteMigrations[index]
      // if there is already a corresponding remote migration,
      // we don't need to apply this migration

      if (remoteMigration) {
        if (
          localMigration.id !== remoteMigration.id &&
          !isWatchMigrationName(remoteMigration.id) // it's fine to have the watch migration remotely
        ) {
          throw new Error(
            `Local and remote migrations are not in lockstep. We have migration ${localMigration.id} locally and ${remoteMigration.id} remotely at the same position in the history.`,
          )
        }
        lastAppliedIndex = index
        return true
      }
      return false
    })

    if (lastAppliedIndex === -1) {
      return 'No migration to roll back'
    }

    if (n && n > appliedMigrations.length) {
      throw new Error(
        `You provided ${chalk.redBright(`n = ${chalk.bold(String(n))}`)}, but there are only ${
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

      const result = await this.engine.unapplyMigration({ sourceConfig: datamodel })

      if (result.errors && result.errors.length > 0) {
        throw new Error(`Errors during rollback: ${JSON.stringify(result.errors)}`)
      }

      lastAppliedIndex--
    }

    return `🚀 Done with ${chalk.bold('down')} in ${formatms(Date.now() - before)}`
  }

  public async up({ n, preview, short, verbose }: UpOptions = {}): Promise<string> {
    await this.getLockFile()
    const before = Date.now()

    const migrationsToApplyResult = await this.getMigrationsToApply()
    const { lastAppliedIndex, localMigrations, appliedRemoteMigrations, sourceConfig } = migrationsToApplyResult
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

      if (lastUnappliedMigration.datamodel.length < 10000) {
        if (lastAppliedMigration) {
          console.log(chalk.bold('Changes to be applied:'))
          console.log(printDatamodelDiff(lastAppliedMigration.datamodel, lastUnappliedMigration.datamodel))
        } else {
          console.log(brightGreen.bold('Datamodel that will initialize the db:\n'))
          console.log(highlightDatamodel(lastUnappliedMigration.datamodel))
        }
      }
    }

    const firstMigrationToApplyIndex = localMigrations.indexOf(migrationsToApply[0])
    const migrationsWithDbSteps = await this.getDatabaseSteps(localMigrations, firstMigrationToApplyIndex, sourceConfig)

    const progressRenderer = new ProgressRenderer(migrationsWithDbSteps, short || false)

    progressRenderer.render()

    if (preview) {
      await progressRenderer.done()
      return `\nTo apply the migrations, run ${chalk.greenBright('prisma2 lift up')}\n`
    }

    for (let i = 0; i < migrationsToApply.length; i++) {
      const migrationToApply = migrationsToApply[i]
      const { id, datamodelSteps } = migrationToApply
      const result = await this.engine.applyMigration({
        force: false,
        migrationId: id,
        steps: datamodelSteps,
        sourceConfig,
      })
      await new Promise(r => setTimeout(r, 50))
      // needed for the ProgressRenderer
      // and for verbose printing
      migrationsWithDbSteps[i].databaseSteps = result.databaseSteps
      const totalSteps = result.databaseSteps.length
      let progress: EngineResults.MigrationProgress | undefined
      progressLoop: while (
        // tslint:disable-next-line
        (progress = await this.engine.migrationProgess({
          migrationId: id,
          sourceConfig,
        }))
      ) {
        if (progress.status === 'MigrationInProgress') {
          progressRenderer.setProgress(i, progress.applied / totalSteps)
        }
        if (progress.status === 'MigrationSuccess') {
          progressRenderer.setProgress(i, 1)
          break progressLoop
        }
        if (progress.status === 'RollbackSuccess') {
          cliCursor.show()
          throw new Error(`Rolled back migration. ${JSON.stringify(progress)}`)
        }
        if (progress.status === 'RollbackFailure') {
          cliCursor.show()
          throw new Error(`Failed to roll back migration. ${JSON.stringify(progress)}`)
        }
        await new Promise(r => setTimeout(r, 1500))
      }

      if (migrationToApply.afterFilePath) {
        const after = migrationToApply.afterFilePath
        plusX(after)
        const child = spawn(after, {
          env: {
            ...process.env,
            FORCE_COLOR: '1',
          },
        })
        child.on('error', e => {
          console.error(e)
        })
        child.stderr.on('data', d => {
          console.log(`stderr ${d.toString()}`)
        })
        progressRenderer.showLogs(path.basename(after), child.stdout)
        await new Promise(r => {
          child.on('close', () => {
            r()
          })
          child.on('exit', () => {
            r()
          })
        })
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

  public stop() {
    this.engine.stop()
  }

  private getMigrationFileMap({ migration, lastMigration }: MigrationFileMapOptions): FileMap {
    const { version } = packageJson
    const { datamodelSteps, datamodel } = migration

    return {
      ['steps.json']: JSON.stringify({ version, steps: datamodelSteps }, null, 2),
      ['schema.prisma']: datamodel,
      ['README.md']: printMigrationReadme({
        migrationId: migration.id,
        lastMigrationId: lastMigration ? lastMigration.id : '',
        datamodelA: lastMigration ? lastMigration.datamodel : '',
        datamodelB: datamodel,
        databaseSteps: migration.databaseSteps,
      }),
    }
  }

  private async persistWatchMigration(options: MigrationFileMapOptions) {
    const fileMap = this.getMigrationFileMap(options)
    await serializeFileMap(fileMap, path.join(this.devMigrationsDir, options.migration.id))
  }

  private async getLocalMigrations(
    migrationsDir = path.join(this.projectDir, 'migrations'),
  ): Promise<LocalMigration[]> {
    if (!(await exists(migrationsDir))) {
      return []
    }
    const migrationSteps = await globby(
      [
        '**/steps.json',
        '**/schema.prisma',
        '**/datamodel.prisma',
        '**/after.sh',
        '**/before.sh',
        '**/after.ts',
        '**/before.ts',
        '!dev',
      ],
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
      const datamodelFile = files.find(f => f.fileName === 'datamodel.prisma' || f.fileName === 'schema.prisma')!
      const afterFile = files.find(f => f.fileName === 'after.sh' || f.fileName === 'after.ts')
      const beforeFile = files.find(f => f.fileName === 'before.sh' || f.fileName === 'before.ts')
      const stepsFileJson = JSON.parse(stepsFile.file)
      if (Array.isArray(stepsFileJson)) {
        throw new Error(
          `We changed the steps.json format - please delete your migrations folder and run prisma lift create again`,
        )
      }
      if (!stepsFileJson.steps) {
        throw new Error(`${stepsFile.fileName} is expected to have a .steps property`)
      }

      return {
        id: migrationId,
        datamodelSteps: stepsFileJson.steps,
        datamodel: datamodelFile.file,
        afterFilePath: afterFile ? path.resolve(migrationsDir, migrationId, afterFile.fileName) : undefined,
        beforeFilePath: beforeFile ? path.resolve(migrationsDir, migrationId, beforeFile.fileName) : undefined,
      }
    })
  }

  private async getDatabaseSteps(
    localMigrations: Migration[],
    fromIndex: number,
    sourceConfig: string,
  ): Promise<LocalMigrationWithDatabaseSteps[]> {
    const migrationsWithDatabaseSteps = await pMap(
      localMigrations,
      async (migration, index) => {
        if (index < fromIndex) {
          return {
            ...migration,
            databaseSteps: [],
          }
        }
        const stepsUntilNow = index > 0 ? localMigrations.slice(0, index).flatMap(m => m.datamodelSteps) : []
        const input = {
          assumeToBeApplied: stepsUntilNow,
          stepsToApply: migration.datamodelSteps,
          sourceConfig,
        }
        const { databaseSteps } = await this.engine.calculateDatabaseSteps(input)
        return {
          ...migration,
          databaseSteps,
        }
      },
      { concurrency: 1 },
    )

    return migrationsWithDatabaseSteps.slice(fromIndex)
  }

  private async getMigrationsToApply(): Promise<{
    localMigrations: LocalMigration[]
    lastAppliedIndex: number
    migrationsToApply: LocalMigration[]
    sourceConfig: string
    appliedRemoteMigrations: EngineResults.StoredMigration[]
  }> {
    const localMigrations = await this.getLocalMigrations()

    const sourceConfig = await this.getSourceConfig()
    const appliedRemoteMigrations = await this.engine.listAppliedMigrations({ sourceConfig })
    const appliedRemoteMigrationsWithoutWatch = appliedRemoteMigrations.filter(m => !isWatchMigrationName(m.id))

    if (appliedRemoteMigrationsWithoutWatch.length > localMigrations.length) {
      const localMigrationIds = localMigrations.map(m => m.id)
      const remoteMigrationIds = appliedRemoteMigrationsWithoutWatch.map(m => m.id)

      throw new Error(
        `There are more migrations in the database than locally. This must not happen. Local migration ids: ${localMigrationIds.join(
          ', ',
        )}. Remote migration ids: ${remoteMigrationIds.join(', ')}`,
      )
    }

    let lastAppliedIndex = -1
    const migrationsToApply = localMigrations.filter((localMigration, index) => {
      const remoteMigration = appliedRemoteMigrationsWithoutWatch[index]
      // if there is already a corresponding remote migration,
      // we don't need to apply this migration

      if (remoteMigration) {
        if (localMigration.id !== remoteMigration.id && !isWatchMigrationName(remoteMigration.id)) {
          throw new Error(
            `Local and remote migrations are not in lockstep. We have migration ${localMigration.id} locally and ${remoteMigration.id} remotely at the same position in the history.`,
          )
        }
        if (!isWatchMigrationName(remoteMigration.id)) {
          lastAppliedIndex = index
          return false
        }
      }
      return true
    })

    return {
      localMigrations,
      lastAppliedIndex,
      migrationsToApply,
      appliedRemoteMigrations,
      sourceConfig,
    }
  }
}

class ProgressRenderer {
  private currentIndex = 0
  private currentProgress = 0
  private statusWidth = 6
  private logsString = ''
  private logsName?: string
  private silent: boolean
  constructor(private migrations: LocalMigrationWithDatabaseSteps[], silent: boolean) {
    cliCursor.hide()
    this.silent = silent
  }

  public setMigrations(migrations: LocalMigrationWithDatabaseSteps[]) {
    this.migrations = migrations
    this.render()
  }

  public setProgress(index: number, progressPercentage: number) {
    const progress = Math.min(Math.floor(progressPercentage * this.statusWidth), this.statusWidth)

    this.currentIndex = index
    this.currentProgress = progress
    this.render()
  }

  public showLogs(name, stream: Readable) {
    this.logsName = name
    this.logsString = ''
    stream.on('data', data => {
      this.logsString += data.toString()
      this.render()
    })
  }

  public render() {
    if (this.silent) {
      return
    }
    const maxMigrationLength = this.migrations.reduce((acc, curr) => Math.max(curr.id.length, acc), 0)
    let maxStepLength = 0
    const rows = this.migrations
      .map(m => {
        const steps = printDatabaseStepsOverview(m.databaseSteps)
        maxStepLength = Math.max(stripAnsi(steps).length, maxStepLength)
        let scripts = ''
        if (m.beforeFilePath || m.afterFilePath) {
          if (m.beforeFilePath && m.afterFilePath) {
            const beforeStr = m.beforeFilePath ? `└─ ${path.basename(m.beforeFilePath)}\n` : ''
            const afterStr = m.afterFilePath ? `\n└─ ${path.basename(m.afterFilePath)}` : ''
            scripts = '\n' + indent(`${beforeStr}└─ ${blue('Datamodel migration')}${afterStr}`, 2)
          } else {
            const beforeStr = m.beforeFilePath ? `└─ ${path.basename(m.beforeFilePath)}\n` : ''
            const afterStr = m.afterFilePath ? `└─ ${path.basename(m.afterFilePath)}` : ''
            scripts = '\n' + indent(`${beforeStr}${afterStr}`, 2)
          }
        }
        return {
          line: `${blue(m.id)}${' '.repeat(maxMigrationLength - m.id.length + 2)}${steps}`,
          scripts,
        }
      })
      .map((m, index) => {
        const maxLength = maxStepLength + maxMigrationLength
        const paddingLeft = maxLength - stripAnsi(m.line).length + 2
        const newLine = m.line + ' '.repeat(paddingLeft) + '  '

        if (this.currentIndex > index || (this.currentIndex === index && this.currentProgress === this.statusWidth)) {
          return newLine + 'Done 🚀' + m.scripts
        } else if (this.currentIndex === index) {
          return newLine + '\u25A0'.repeat(this.currentProgress) + m.scripts
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
        'prisma2 lift up --verbose',
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

  public async done() {
    cliCursor.show()
  }
}
