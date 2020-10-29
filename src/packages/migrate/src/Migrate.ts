import {
  getSchemaPathSync,
  drawBox,
  getGenerators,
  ProviderAliases,
  link,
  getCommandWithExecutor,
  highlightDatamodel,
  maskSchema,
  uriToCredentials,
  getConfig,
  isCi,
} from '@prisma/sdk'
import chalk from 'chalk'
import { spawn } from 'child_process'
import cliCursor from 'cli-cursor'
import dashify from 'dashify'
import Debug from '@prisma/debug'
import fs from 'fs'
import globby from 'globby'
import indent from 'indent-string'
import logUpdate from 'log-update'
import makeDir = require('make-dir')
import pMap from 'p-map'
import path from 'path'
import { prompt } from 'prompts'
import rimraf from 'rimraf'
import { Readable } from 'stream'
import stripAnsi from 'strip-ansi'
import { promisify } from 'util'
import { blue } from '@prisma/sdk/dist/highlight/theme'
import { MigrateEngine } from './MigrateEngine'
import {
  EngineResults,
  FileMap,
  LocalMigration,
  LocalMigrationWithDatabaseSteps,
  LockFile,
  Migration,
} from './types'
import { exit } from './utils/exit'
import { formatms } from './utils/formatms'
import { groupBy } from './utils/groupBy'
import { isWatchMigrationName } from './utils/isWatchMigrationName'
import {
  deserializeLockFile,
  initLockFile,
  serializeLockFile,
} from './utils/LockFile'
import { now, timestampToDate } from './utils/now'
import plusX from './utils/plusX'
import {
  highlightMigrationsSQL,
  printDatabaseStepsOverview,
} from './utils/printDatabaseSteps'
import { printDatamodelDiff } from './utils/printDatamodelDiff'
import { printMigrationReadme } from './utils/printMigrationReadme'
import {
  getDbinfoFromCredentials,
  getDbLocation,
} from './utils/ensureDatabaseExists'
import { serializeFileMap } from './utils/serializeFileMap'
import { simpleDebounce } from './utils/simpleDebounce'
import { flatMap } from './utils/flatMap'
const debug = Debug('migrate')
const packageJson = eval(`require('../package.json')`) // tslint:disable-line

const del = promisify(rimraf)
const readFile = promisify(fs.readFile)
const exists = promisify(fs.exists)

export interface MigrateOptions {
  name?: string
  isDraft?: boolean
}
export interface UpOptions {
  preview?: boolean
  n?: number
  short?: boolean
  verbose?: boolean
  autoApprove?: boolean
  onWarnings?: (warnings: EngineResults.Warning[]) => Promise<boolean>
}
export interface DownOptions {
  n?: number
}

export interface WatchOptions {
  preview?: boolean
  providerAliases: ProviderAliases
  clear?: boolean
  autoApprove?: boolean
  onWarnings?: (warnings: EngineResults.Warning[]) => Promise<boolean>
  skipGenerate?: boolean
}
interface MigrationFileMapOptions {
  migration: LocalMigrationWithDatabaseSteps
  lastMigration?: Migration
}
const brightGreen = chalk.rgb(127, 224, 152)

export class Migrate {
  get devMigrationsDir(): string {
    return path.join(path.dirname(this.schemaPath), 'migrations/dev')
  }
  public engine: MigrateEngine

  // tslint:disable
  public watchUp = simpleDebounce(
    async (
      { onWarnings, autoApprove, skipGenerate }: WatchOptions = {
        clear: true,
        providerAliases: {},
      },
    ) => {
      const datamodel = this.getDatamodel()
      try {
        const watchMigrationName = `watch-${now()}`
        const migration = await this.createMigration(watchMigrationName)
        const existingWatchMigrations = await this.getLocalWatchMigrations()

        if (
          migration &&
          migration.warnings &&
          migration.warnings.length > 0 &&
          onWarnings &&
          !autoApprove
        ) {
          // if (migration?.warnings && onWarnings) { As soon as ts-node uses TS 3.7
          const ok = await onWarnings(migration.warnings)
          if (!ok) {
            await exit()
          }
        }

        if (migration) {
          debug('There is a migration we are going to apply now')
          await this.engine.applyMigration({
            force: true,
            migrationId: migration.id,
            steps: migration.datamodelSteps,
            sourceConfig: datamodel,
          })
          debug(`Applied migration`)
          const lastWatchMigration =
            existingWatchMigrations.length > 0
              ? existingWatchMigrations[existingWatchMigrations.length - 1]
              : undefined

          await this.persistWatchMigration({
            migration,
            lastMigration: lastWatchMigration,
          })
        } else {
          debug(`No migration to apply`)
        }

        if (!skipGenerate) {
          const generators = await getGenerators({
            schemaPath: this.schemaPath,
            printDownloadProgress: false,
            version: packageJson.prisma.version,
            cliVersion: packageJson.version,
          })

          const version =
            packageJson.name === '@prisma/cli' ? packageJson.version : null

          for (let i = 0; i < generators.length; i++) {
            const generator = generators[i]
            if (
              version &&
              generator.manifest?.version &&
              generator.manifest?.version !== version &&
              generator.options?.generator.provider === 'prisma-client-js'
            ) {
              console.error(
                `${chalk.bold(
                  `@prisma/client@${generator.manifest?.version}`,
                )} is not compatible with ${chalk.bold(
                  `@prisma/cli@${version}`,
                )}. Their versions need to be equal.`,
              )
            }

            try {
              debug(`Generating ${generator.manifest!.prettyName}`)
              await generator.generate()
              generator.stop()
            } catch (error) {}
          }
        }
      } catch (error) {}
    },
  )
  // tsline:enable
  private datamodelBeforeWatch = ''
  private schemaPath: string
  public migrationsDirectoryPath: string
  constructor(schemaPath?: string, enabledPreviewFeatures?: string[]) {
    this.schemaPath = this.getSchemaPath(schemaPath)
    this.migrationsDirectoryPath = path.join(
      path.dirname(this.schemaPath),
      'migrations',
    )
    this.engine = new MigrateEngine({
      projectDir: path.dirname(this.schemaPath),
      schemaPath: this.schemaPath,
      enabledPreviewFeatures,
    })
  }

  public getSchemaPath(schemaPathFromOptions?): string {
    const schemaPath = getSchemaPathSync(schemaPathFromOptions)

    if (!schemaPath) {
      throw new Error(
        `Could not find a ${chalk.bold(
          'schema.prisma',
        )} file that is required for this command.\nYou can either provide it with ${chalk.greenBright(
          '--schema',
        )}, set it as \`prisma.schema\` in your package.json or put it into the default location ${chalk.greenBright(
          './prisma/schema.prisma',
        )} https://pris.ly/d/prisma-schema-location`,
      )
    }

    return schemaPath
  }

  public getDatamodel(): string {
    return fs.readFileSync(this.schemaPath, 'utf-8')
  }

  public async initialize(): Promise<void> {
    if (fs.existsSync(this.migrationsDirectoryPath)) {
      console.info('The project was already initialized.')
      return
    }
    return fs.mkdirSync(this.migrationsDirectoryPath)

    // not implemented yet
    // await this.engine.initialize({
    //   migrationsDirectoryPath: this.migrationsDirectoryPath,
    // })
  }

  public async reset(): Promise<void> {
    await this.engine.reset()
  }

  public async draft({ name = '' }: MigrateOptions = {}): Promise<
    string | undefined
  > {
    const datamodel = this.getDatamodel()
    const createMigrationResult = await this.engine.createMigration({
      migrationsDirectoryPath: this.migrationsDirectoryPath,
      migrationName: name,
      draft: true,
      prismaSchema: datamodel,
    })

    // A migration was created
    if (createMigrationResult.generatedMigrationName) {
      return createMigrationResult.generatedMigrationName
    }

    // No migration created
    return
  }

  public async checkHistoryAndReset({
    force = false,
  }): Promise<string[] | undefined> {
    const {
      drift,
      history,
      failedMigrationNames,
      editedMigrationNames,
    } = await this.engine.diagnoseMigrationHistory({
      migrationsDirectoryPath: this.migrationsDirectoryPath,
    })

    let isResetNeeded = false

    if (failedMigrationNames.length > 0) {
      // migration(s), usually one, that failed to apply the the database (which may have data)
      console.info(
        `The following migrations failed to apply:\n- ${failedMigrationNames.join(
          '\n- ',
        )}\n`,
      )
      isResetNeeded = true
    }

    if (editedMigrationNames.length > 0) {
      // migration(s) that were edited since they were applied to the db.
      console.info(
        `The following migrations were edited after they were applied:\n- ${editedMigrationNames.join(
          '\n- ',
        )}\n`,
      )
      isResetNeeded = true
    }

    if (drift) {
      debug({ drift })
      if (drift.diagnostic === 'migrationFailedToApply') {
        // Migration has a problem (failed to cleanly apply to a temporary database) and needs to be fixed or the database has a problem (example: incorrect version, missing extension)
        throw new Error(
          `The migration "${drift.migrationName}" failed to apply to the shadow database.\nFix the migration before applying it again.\n\n${drift.error})`,
        )
      } else if (drift.diagnostic === 'driftDetected') {
        // we could try to fix the drift in the future
        isResetNeeded = true
      }
    }

    if (history) {
      debug({ history })
      if (history.diagnostic === 'databaseIsBehind') {
        return this.applyOnly()
      } else if (history.diagnostic === 'migrationsDirectoryIsBehind') {
        isResetNeeded = true
        debug({
          unpersistedMigrationNames: history.unpersistedMigrationNames,
        })
      } else if (history.diagnostic === 'historiesDiverge') {
        isResetNeeded = true
        debug({
          lastCommonMigrationName: history.lastCommonMigrationName,
        })
        debug({
          unappliedMigrationNames: history.unappliedMigrationNames,
        })
        debug({
          unpersistedMigrationNames: history.unpersistedMigrationNames,
        })
      }
    }

    if (isResetNeeded) {
      if (!force && isCi()) {
        throw Error(
          `Use the --force flag to use the reset command in an unnattended environment like ${chalk.bold.greenBright(
            getCommandWithExecutor(
              'prisma reset --force --early-access-feature',
            ),
          )}`,
        )
      }
      await this.confirmReset()
      await this.reset()
    }
  }

  public async confirmReset(): Promise<void> {
    const datamodel = this.getDatamodel()
    const config = await getConfig({ datamodel })
    const activeDatasource = config.datasources[0]
    const credentials = uriToCredentials(activeDatasource.url.value)
    const { schemaWord, dbType, dbName } = getDbinfoFromCredentials(credentials)

    const confirmation = await prompt({
      type: 'confirm',
      name: 'value',
      message: `We need to reset the ${dbType} ${schemaWord} "${dbName}" at "${getDbLocation(
        credentials,
      )}". ${chalk.red('All data will be lost')}.\nDo you want to continue?`,
    })

    if (!confirmation.value) {
      await exit()
    }
  }

  public async applyOnly(): Promise<string[]> {
    const { appliedMigrationNames } = await this.engine.applyMigrations({
      migrationsDirectoryPath: this.migrationsDirectoryPath,
    })
    debug({ appliedMigrationNames })

    return appliedMigrationNames
  }

  public async evaluateDataLoss(): Promise<
    EngineResults.EvaluateDataLossOutput
  > {
    const datamodel = this.getDatamodel()

    const evaluateDataLossResult = await this.engine.evaluateDataLoss({
      migrationsDirectoryPath: this.migrationsDirectoryPath,
      prismaSchema: datamodel,
    })

    debug({ evaluateDataLossResult })
    return evaluateDataLossResult
  }

  public async createAndApply({ name = '' }: MigrateOptions = {}): Promise<
    string[]
  > {
    const datamodel = this.getDatamodel()

    // success?
    const createMigrationResult = await this.engine.createMigration({
      migrationsDirectoryPath: this.migrationsDirectoryPath,
      migrationName: name,
      draft: false,
      prismaSchema: datamodel,
    })
    debug({ createMigrationResult })

    // success?
    return this.applyOnly()
  }

  public async push({
    force = false,
  }: {
    force?: boolean
  }): Promise<EngineResults.SchemaPush> {
    const datamodel = this.getDatamodel()

    const {
      warnings,
      unexecutable,
      executedSteps,
    } = await this.engine.schemaPush({
      force,
      schema: datamodel,
    })

    return {
      executedSteps,
      warnings,
      unexecutable,
    }
  }

  public async tryToRunGenerate(): Promise<void> {
    const message: string[] = []

    console.info() // empty line
    logUpdate(
      `Running generate... ${chalk.dim(
        '(Use --skip-generate to skip the generators)',
      )}`,
    )

    try {
      const generators = await getGenerators({
        schemaPath: this.schemaPath,
        printDownloadProgress: false,
        version: packageJson.prisma.version,
        cliVersion: packageJson.version,
      })

      for (const generator of generators) {
        const toStr = generator.options!.generator.output!
          ? chalk.dim(
              ` to .${path.sep}${path.relative(
                process.cwd(),
                generator.options!.generator.output!,
              )}`,
            )
          : ''
        const name = generator.manifest
          ? generator.manifest.prettyName
          : generator.options!.generator.provider

        logUpdate(`Running generate... - ${name}`)

        const before = Date.now()
        try {
          await generator.generate()
          const after = Date.now()
          const version = generator.manifest?.version
          message.push(
            `✔ Generated ${chalk.bold(name!)}${
              version ? ` (version: ${version})` : ''
            }${toStr} in ${formatms(after - before)}`,
          )
          generator.stop()
        } catch (err) {
          message.push(`${err.message}`)
          generator.stop()
        }
      }
    } catch (errGetGenerators) {
      throw errGetGenerators
    }

    logUpdate(message.join('\n'))
  }

  //
  // "Old" Migrate
  //

  // TODO: optimize datapaths, where we have a datamodel already, use it
  public getSourceConfig(): string {
    return this.getDatamodel()
  }

  public async getLockFile(): Promise<LockFile> {
    const lockFilePath = path.resolve(
      path.dirname(this.schemaPath),
      'migrations',
      'migrate.lock',
    )
    if (await exists(lockFilePath)) {
      const file = await readFile(lockFilePath, 'utf-8')
      const lockFile = deserializeLockFile(file)
      if (lockFile.remoteBranch) {
        throw new Error(
          `There's a merge conflict in the ${chalk.bold(
            'migrations/migrate.lock',
          )} file.`,
        )
      }
      return lockFile
    }

    return initLockFile()
  }

  public async createMigration(
    migrationId: string,
  ): Promise<LocalMigrationWithDatabaseSteps | undefined> {
    const {
      migrationsToApply,
      sourceConfig,
    } = await this.getMigrationsToApply()

    const assumeToBeApplied = flatMap(
      migrationsToApply,
      (m) => m.datamodelSteps,
    )

    const datamodel = this.getDatamodel()
    const {
      datamodelSteps,
      databaseSteps,
      warnings,
      unexecutableMigrations,
    } = await this.engine.inferMigrationSteps({
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
      warnings,
      unexecutableMigrations,
    }
  }

  public getMigrationId(name?: string): string {
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
    const lastMigration =
      localMigrations.length > 0
        ? localMigrations[localMigrations.length - 1]
        : undefined

    // TODO better printing of params
    const nameStr = name ? ` --name ${chalk.bold(name)}` : ''
    const previewStr = preview ? ` --preview` : ''
    console.log(`📼  migrate save${nameStr}${previewStr}`)
    if (lastMigration) {
      const wording = preview
        ? `Potential datamodel changes:`
        : 'Local datamodel Changes:'
      console.log(chalk.bold(`\n${wording}\n`))
    } else {
      console.log(brightGreen.bold('\nNew datamodel:\n'))
    }
    if (lastMigration) {
      console.log(
        printDatamodelDiff(lastMigration.datamodel, maskSchema(datamodel)),
      )
    } else {
      console.log(highlightDatamodel(maskSchema(datamodel)))
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
    options: WatchOptions = {
      preview: false,
      clear: true,
      providerAliases: {},
    },
  ): Promise<string> {
    if (!options.clear) {
      options.clear = true
    }

    const datamodel = this.getDatamodel()

    const generators = await getGenerators({
      schemaPath: this.schemaPath,
      printDownloadProgress: false,
      version: packageJson.prisma.version,
      cliVersion: packageJson.version,
    })

    const relativeDatamodelPath = path.relative(process.cwd(), this.schemaPath)

    // From here on, we render the dev ui
    // silent everyone else. this is not a democracy 👹
    console.log = (...args): void => {
      debug(...args)
    }

    // console.error = (...args) => {
    //   debug(...args)
    // }

    const { migrationsToApply } = await this.getMigrationsToApply()

    if (migrationsToApply.length > 0) {
      // TODO: Ask for permission if we actually want to do it?
      // console.log(`Applying unapplied migrations ${chalk.blue(migrationsToApply.map(m => m.id).join(', '))}\n`)
      await this.upLegacy({
        short: true,
        autoApprove: options.autoApprove,
      })
      // console.log(`Done applying migrations in ${formatms(Date.now() - before)}`)
      options.clear = false
    }

    const localMigrations = await this.getLocalMigrations()
    const watchMigrations = await this.getLocalWatchMigrations()

    let lastChanged: undefined | Date
    if (watchMigrations.length > 0) {
      const timestamp = watchMigrations[watchMigrations.length - 1].id.split(
        '-',
      )[1]
      lastChanged = timestampToDate(timestamp)
    } else if (localMigrations.length > 0) {
      lastChanged = timestampToDate(
        localMigrations[localMigrations.length - 1].id.split('-')[0],
      )
    }

    if (localMigrations.length > 0) {
      this.datamodelBeforeWatch =
        localMigrations[localMigrations.length - 1].datamodel
    }

    await makeDir(this.devMigrationsDir)

    fs.watch(this.schemaPath, (eventType, filename) => {
      if (eventType === 'change') {
        this.watchUp(options)
      }
    })

    this.watchUp(options)
    return ''
  }

  public async down({ n }: DownOptions): Promise<string> {
    await this.getLockFile()
    const before = Date.now()
    const localMigrations = await this.getLocalMigrations()
    const localWatchMigrations = await this.getLocalWatchMigrations()
    if (localWatchMigrations.length > 0) {
      throw new Error(
        `Before running ${chalk.yellow(
          getCommandWithExecutor('prisma migrate down --experimental'),
        )}, please save your ${chalk.bold(
          'dev',
        )} changes using ${chalk.bold.greenBright(
          getCommandWithExecutor('prisma migrate save --experimental'),
        )} and ${chalk.bold.greenBright(
          getCommandWithExecutor('prisma migrate up --experimental'),
        )}`,
      )
    }
    const datamodel = this.getDatamodel()
    const appliedRemoteMigrations = await this.engine.listAppliedMigrations({
      sourceConfig: datamodel,
    })

    let lastAppliedIndex = -1
    const appliedMigrations = localMigrations.filter(
      (localMigration, index) => {
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

      const result = await this.engine.unapplyMigration({
        sourceConfig: datamodel,
      })

      if (result.errors && result.errors.length > 0) {
        throw new Error(
          `Errors during rollback: ${JSON.stringify(result.errors)}`,
        )
      }

      lastAppliedIndex--
    }

    return `${
      process.platform === 'win32' ? '' : chalk.bold.green('🚀  ')
    } Done with ${chalk.bold('down')} in ${formatms(Date.now() - before)}`
  }

  public async upLegacy({
    n,
    preview,
    short,
    verbose,
    autoApprove,
    onWarnings,
  }: UpOptions = {}): Promise<string> {
    await this.getLockFile()
    const before = Date.now()

    const migrationsToApplyResult = await this.getMigrationsToApply()
    const {
      lastAppliedIndex,
      localMigrations,
      appliedRemoteMigrations,
      sourceConfig,
    } = migrationsToApplyResult
    let { migrationsToApply } = migrationsToApplyResult

    if (typeof n === 'number') {
      migrationsToApply = migrationsToApply.slice(0, n)
    }

    if (!short) {
      const previewStr = preview ? ` --preview` : ''
      console.log(
        `${
          process.platform === 'win32' ? '' : '🏋️‍  '
        }migrate up${previewStr}\n`,
      )

      if (migrationsToApply.length === 0) {
        return 'All migrations are already applied'
      }

      const lastAppliedMigration: Migration | undefined =
        lastAppliedIndex > -1 ? localMigrations[lastAppliedIndex] : undefined
      const lastUnappliedMigration: Migration = migrationsToApply.slice(-1)[0]

      if (lastUnappliedMigration.datamodel.length < 10000) {
        if (lastAppliedMigration) {
          console.log(chalk.bold('Changes to be applied:') + '\n')
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
      console.log(`\nChecking the datasource for potential data loss...`)
    }

    const firstMigrationToApplyIndex = localMigrations.indexOf(
      migrationsToApply[0],
    )
    const migrationsWithDbSteps = await this.getDatabaseSteps(
      localMigrations,
      firstMigrationToApplyIndex,
      sourceConfig,
    )

    const warnings = flatMap(migrationsWithDbSteps, (m) => m.warnings)

    if (warnings.length > 0 && !autoApprove) {
      if (onWarnings && typeof onWarnings === 'function' && !autoApprove) {
        const ok = await onWarnings(warnings)
        if (!ok) {
          await exit()
        }
      }
      console.log(chalk.bold(`\n\n⚠️  There will be data loss:\n`))
      for (const warning of warnings) {
        console.log(`  • ${warning.description}`)
      }
      console.log() // empty line before prompt
      if (!autoApprove && !onWarnings) {
        const response = await prompt({
          type: 'confirm',
          name: 'value',
          message: `Are you sure you want to apply this change?`,
        })

        if (!response.value) {
          await exit()
        }
      } else {
        console.log(
          `As ${chalk.bold(
            '--auto-approve',
          )} is provided, the destructive changes are accepted.\n`,
        )
      }
    }

    const progressRenderer = new ProgressRenderer(
      migrationsWithDbSteps,
      short || false,
    )

    progressRenderer.render()

    if (preview) {
      progressRenderer.done()
      return `\nTo apply the migrations, run ${chalk.greenBright(
        getCommandWithExecutor('prisma migrate up --experimental'),
      )}\n`
    }

    for (let i = 0; i < migrationsToApply.length; i++) {
      const migrationToApply = migrationsToApply[i]
      const { id, datamodelSteps } = migrationToApply
      const result = await this.engine.applyMigration({
        force: true,
        migrationId: id,
        steps: datamodelSteps,
        sourceConfig,
      })

      await new Promise((r) => setTimeout(r, 50))
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
          throw new Error(
            `Failed to roll back migration. ${JSON.stringify(progress)}`,
          )
        }
        await new Promise((r) => setTimeout(r, 1500))
      }

      if (migrationToApply.afterFilePath) {
        const after = migrationToApply.afterFilePath
        if (process.platform !== 'win32') {
          plusX(after)
        }
        const child = spawn(after, {
          env: {
            ...process.env,
            FORCE_COLOR: '1',
          },
        })
        child.on('error', (e) => {
          console.error(e)
        })
        child.stderr.on('data', (d) => {
          console.log(`stderr ${d.toString()}`)
        })
        progressRenderer.showLogs(path.basename(after), child.stdout)
        await new Promise((r) => {
          child.on('close', () => {
            r()
          })
          child.on('exit', () => {
            r()
          })
        })
      }
    }
    progressRenderer.done()

    if (verbose) {
      console.log(chalk.bold(`\nSQL Commands:\n`))
      console.log(highlightMigrationsSQL(migrationsWithDbSteps))
      console.log('\n')
    }

    return `\n${
      process.platform === 'win32' ? '' : chalk.bold.green('🚀  ')
    }  Done with ${migrationsToApply.length} migration${
      migrationsToApply.length > 1 ? 's' : ''
    } in ${formatms(Date.now() - before)}.\n`
  }

  public stop(): void {
    this.engine.stop()
  }

  private getMigrationFileMap({
    migration,
    lastMigration,
  }: MigrationFileMapOptions): FileMap {
    // const { version } = packageJson
    const { datamodelSteps, datamodel } = migration

    return {
      ['steps.json']: JSON.stringify(
        { version: '0.3.14-fixed', steps: datamodelSteps },
        null,
        2,
      ),
      ['schema.prisma']: maskSchema(datamodel),
      ['README.md']: printMigrationReadme({
        migrationId: migration.id,
        lastMigrationId: lastMigration ? lastMigration.id : '',
        datamodelA: lastMigration ? lastMigration.datamodel : '',
        datamodelB: datamodel,
        databaseSteps: migration.databaseSteps,
      }),
    }
  }

  private async persistWatchMigration(
    options: MigrationFileMapOptions,
  ): Promise<void> {
    const fileMap = this.getMigrationFileMap(options)
    await serializeFileMap(
      fileMap,
      path.join(this.devMigrationsDir, options.migration.id),
    )
  }

  private async getLocalMigrations(
    migrationsDir = path.join(path.dirname(this.schemaPath), 'migrations'),
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
        // globby doesn't have it in its types but it's part of mrmlnc/fast-glob
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        cwd: migrationsDir,
      },
    ).then((files) =>
      Promise.all(
        files.map(async (fileName) => ({
          fileName: fileName.split('/')[1],
          migrationId: fileName.split('/')[0],
          file: await readFile(path.join(migrationsDir, fileName), 'utf-8'),
        })),
      ),
    )

    migrationSteps.sort((a, b) => (a.migrationId < b.migrationId ? -1 : 1))

    const groupedByMigration = groupBy<any>(
      migrationSteps,
      (step) => step.migrationId,
    ) // todo fix types

    return Object.entries(groupedByMigration).map(([migrationId, files]) => {
      const stepsFile = files.find((f) => f.fileName === 'steps.json')!
      const datamodelFile = files.find(
        (f) =>
          f.fileName === 'datamodel.prisma' || f.fileName === 'schema.prisma',
      )!
      const afterFile = files.find(
        (f) => f.fileName === 'after.sh' || f.fileName === 'after.ts',
      )
      const beforeFile = files.find(
        (f) => f.fileName === 'before.sh' || f.fileName === 'before.ts',
      )
      const stepsFileJson = JSON.parse(stepsFile.file)
      if (Array.isArray(stepsFileJson)) {
        throw new Error(
          `We changed the steps.json format - please delete your migrations folder and run ${chalk.greenBright(
            getCommandWithExecutor('prisma migrate save --experimental'),
          )} again`,
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
        afterFilePath: afterFile
          ? path.resolve(migrationsDir, migrationId, afterFile.fileName)
          : undefined,
        beforeFilePath: beforeFile
          ? path.resolve(migrationsDir, migrationId, beforeFile.fileName)
          : undefined,
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
            warnings: [],
            unexecutableMigrations: [],
          }
        }
        const stepsUntilNow =
          index > 0
            ? flatMap(localMigrations.slice(0, index), (m) => m.datamodelSteps)
            : []
        const input = {
          assumeToBeApplied: stepsUntilNow,
          stepsToApply: migration.datamodelSteps,
          sourceConfig,
        }
        const {
          databaseSteps,
          warnings,
          unexecutableMigrations,
        } = await this.engine.calculateDatabaseSteps(input)
        return {
          ...migration,
          databaseSteps,
          warnings,
          unexecutableMigrations,
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

    const sourceConfig = this.getSourceConfig()
    const appliedRemoteMigrations = await this.engine.listAppliedMigrations({
      sourceConfig,
    })
    const appliedRemoteMigrationsWithoutWatch = appliedRemoteMigrations.filter(
      (m) => !isWatchMigrationName(m.id),
    )

    if (appliedRemoteMigrationsWithoutWatch.length > localMigrations.length) {
      const localMigrationIds = localMigrations.map((m) => m.id)
      const remoteMigrationIds = appliedRemoteMigrationsWithoutWatch.map(
        (m) => m.id,
      )

      throw new Error(
        `There are more migrations in the database than locally. This must not happen.\nLocal migration ids: ${
          localMigrationIds.length > 0
            ? localMigrationIds.join(', ')
            : `(empty)`
        }.\nRemote migration ids: ${remoteMigrationIds.join(', ')}`,
      )
    }

    let lastAppliedIndex = -1
    const migrationsToApply = localMigrations.filter(
      (localMigration, index) => {
        const remoteMigration = appliedRemoteMigrationsWithoutWatch[index]
        // if there is already a corresponding remote migration,
        // we don't need to apply this migration

        if (remoteMigration) {
          if (
            localMigration.id !== remoteMigration.id &&
            !isWatchMigrationName(remoteMigration.id)
          ) {
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
      },
    )

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
  constructor(
    private migrations: LocalMigrationWithDatabaseSteps[],
    silent: boolean,
  ) {
    cliCursor.hide()
    this.silent = silent
  }

  public setMigrations(migrations: LocalMigrationWithDatabaseSteps[]): void {
    this.migrations = migrations
    this.render()
  }

  public setProgress(index: number, progressPercentage: number): void {
    const progress = Math.min(
      Math.floor(progressPercentage * this.statusWidth),
      this.statusWidth,
    )

    this.currentIndex = index
    this.currentProgress = progress
    this.render()
  }

  public showLogs(name, stream: Readable): void {
    this.logsName = name
    this.logsString = ''
    stream.on('data', (data) => {
      this.logsString += data.toString()
      this.render()
    })
  }

  public render(): void {
    if (this.silent) {
      return
    }
    const maxMigrationLength = this.migrations.reduce(
      (acc, curr) => Math.max(curr.id.length, acc),
      0,
    )
    let maxStepLength = 0
    const rows = this.migrations
      .map((m) => {
        const steps = printDatabaseStepsOverview(m.databaseSteps)
        maxStepLength = Math.max(stripAnsi(steps).length, maxStepLength)
        let scripts = ''
        if (m.beforeFilePath || m.afterFilePath) {
          if (m.beforeFilePath && m.afterFilePath) {
            const beforeStr = m.beforeFilePath
              ? `└─ ${path.basename(m.beforeFilePath)}\n`
              : ''
            const afterStr = m.afterFilePath
              ? `\n└─ ${path.basename(m.afterFilePath)}`
              : ''
            scripts =
              '\n' +
              indent(
                `${beforeStr}└─ ${blue('Datamodel migration')}${afterStr}`,
                2,
              )
          } else {
            const beforeStr = m.beforeFilePath
              ? `└─ ${path.basename(m.beforeFilePath)}\n`
              : ''
            const afterStr = m.afterFilePath
              ? `└─ ${path.basename(m.afterFilePath)}`
              : ''
            scripts = '\n' + indent(`${beforeStr}${afterStr}`, 2)
          }
        }
        return {
          line: `${blue(m.id)}${' '.repeat(
            maxMigrationLength - m.id.length + 2,
          )}${steps}`,
          scripts,
        }
      })
      .map((m, index) => {
        const maxLength = maxStepLength + maxMigrationLength
        const paddingLeft = maxLength - stripAnsi(m.line).length + 4
        const newLine = m.line + ' '.repeat(paddingLeft) + '  '

        if (
          this.currentIndex > index ||
          (this.currentIndex === index &&
            this.currentProgress === this.statusWidth)
        ) {
          return (
            newLine +
            `Done ${
              process.platform === 'win32' ? '' : chalk.bold.green('🚀  ')
            }` +
            m.scripts
          )
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
      '  ' +
      chalk.underline(column3) +
      '\n\n'

    const changeOverview = header + rows

    let str = ''
    str += chalk.bold('\nDatabase Changes:\n\n')
    str += changeOverview

    const migrationsIdsPaths = this.migrations.reduce((acc, m) => {
      acc += `\n      ${link(`./migrations/${m.id}/README.md`)}\n`
      return acc
    }, '')
    str += chalk.dim(
      `\n\nYou can get the detailed db changes with ${chalk.greenBright(
        getCommandWithExecutor('prisma migrate up --experimental --verbose'),
      )}\nOr read about them here:${migrationsIdsPaths}`,
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

  public done(): void {
    cliCursor.show()
  }
}
