import type { PrismaConfigInternal } from '@prisma/config'
import Debug from '@prisma/debug'
import {
  arg,
  canPrompt,
  checkUnsupportedDataProxy,
  type Command,
  format,
  getCommandWithExecutor,
  getConfig,
  getSchemaWithPath,
  HelpError,
  isError,
  loadEnvFile,
  toSchemasContainer,
  validate,
} from '@prisma/internals'
import { bold, dim, green, red } from 'kleur/colors'
import prompt from 'prompts'

import { Migrate } from '../Migrate'
import type { EngineResults } from '../types'
import type { DatasourceInfo } from '../utils/ensureDatabaseExists'
import { ensureDatabaseExists, getDatasourceInfo } from '../utils/ensureDatabaseExists'
import { MigrateDevEnvNonInteractiveError } from '../utils/errors'
import { getSchemaPathAndPrint } from '../utils/getSchemaPathAndPrint'
import { handleUnexecutableSteps } from '../utils/handleEvaluateDataloss'
import { printDatasource } from '../utils/printDatasource'
import { printFilesFromMigrationIds } from '../utils/printFiles'
import { printMigrationId } from '../utils/printMigrationId'
import { getMigrationName } from '../utils/promptForMigrationName'
import { executeSeedCommand, getSeedCommandFromPackageJson, verifySeedConfigAndReturnMessage } from '../utils/seed'

const debug = Debug('prisma:migrate:dev')

export class MigrateDev implements Command {
  public static new(): MigrateDev {
    return new MigrateDev()
  }

  private static help = format(`
${
  process.platform === 'win32' ? '' : '🏋️  '
}Create a migration from changes in Prisma schema, apply it to the database, trigger generators (e.g. Prisma Client)
 
${bold('Usage')}

  ${dim('$')} prisma migrate dev [options]

${bold('Options')}

       -h, --help   Display this help message
         --config   Custom path to your Prisma config file
         --schema   Custom path to your Prisma schema
       -n, --name   Name the migration
    --create-only   Create a new migration but do not apply it
                    The migration will be empty if there are no changes in Prisma schema
  --skip-generate   Skip triggering generators (e.g. Prisma Client)
      --skip-seed   Skip triggering seed

${bold('Examples')}

  Create a migration from changes in Prisma schema, apply it to the database, trigger generators (e.g. Prisma Client)
  ${dim('$')} prisma migrate dev

  Specify a schema
  ${dim('$')} prisma migrate dev --schema=./schema.prisma

  Create a migration without applying it
  ${dim('$')} prisma migrate dev --create-only
  `)

  public async parse(argv: string[], config: PrismaConfigInternal): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--name': String,
      '-n': '--name',
      // '--force': Boolean,
      // '-f': '--force',
      '--create-only': Boolean,
      '--schema': String,
      '--config': String,
      '--skip-generate': Boolean,
      '--skip-seed': Boolean,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    await checkUnsupportedDataProxy('migrate dev', args, config.schema, true)

    if (args['--help']) {
      return this.help()
    }

    await loadEnvFile({ schemaPath: args['--schema'], printMessage: true, config })

    const { schemaPath, schemas } = (await getSchemaPathAndPrint(args['--schema'], config.schema))!

    const datasourceInfo = await getDatasourceInfo({ schemaPath })
    printDatasource({ datasourceInfo })

    process.stdout.write('\n') // empty line

    // Validate schema (same as prisma validate)
    validate({
      schemas,
    })
    await getConfig({
      datamodel: schemas,
      ignoreEnvVarErrors: false,
    })

    // Automatically create the database if it doesn't exist
    const wasDbCreated = await ensureDatabaseExists('create', schemaPath)
    if (wasDbCreated) {
      process.stdout.write(`${wasDbCreated}\n\n`)
    }

    const migrate = new Migrate(schemaPath)

    let devDiagnostic: EngineResults.DevDiagnosticOutput
    try {
      devDiagnostic = await migrate.devDiagnostic()
      debug({ devDiagnostic: JSON.stringify(devDiagnostic, null, 2) })
    } catch (e) {
      migrate.stop()
      throw e
    }

    const migrationIdsApplied: string[] = []

    if (devDiagnostic.action.tag === 'reset') {
      this.logResetReason({
        datasourceInfo,
        reason: devDiagnostic.action.reason,
      })

      process.stdout.write(
        `\nYou may use ${red('prisma migrate reset')} to drop the development database.\n${bold(red('All data will be lost.'))}\n`,
      )
      migrate.stop()
      // Return SIGINT exit code to signal that the process was cancelled.
      process.exit(130)
    }

    try {
      const { appliedMigrationNames } = await migrate.applyMigrations()
      migrationIdsApplied.push(...appliedMigrationNames)

      // Inform user about applied migrations now
      if (appliedMigrationNames.length > 0) {
        process.stdout.write(
          `\nThe following migration(s) have been applied:\n\n${printFilesFromMigrationIds(
            'migrations',
            appliedMigrationNames,
            {
              'migration.sql': '',
            },
          )}\n`,
        )
      }
    } catch (e) {
      migrate.stop()
      throw e
    }

    let evaluateDataLossResult: EngineResults.EvaluateDataLossOutput
    try {
      evaluateDataLossResult = await migrate.evaluateDataLoss()
      debug({ evaluateDataLossResult })
    } catch (e) {
      migrate.stop()
      throw e
    }

    // display unexecutableSteps
    // throws error if not create-only
    const unexecutableStepsError = handleUnexecutableSteps(
      evaluateDataLossResult.unexecutableSteps,
      args['--create-only'],
    )
    if (unexecutableStepsError) {
      migrate.stop()
      throw new Error(unexecutableStepsError)
    }

    // log warnings and prompt user to continue if needed
    if (evaluateDataLossResult.warnings && evaluateDataLossResult.warnings.length > 0) {
      process.stdout.write(bold('\n⚠️  Warnings for the current datasource:\n\n'))
      for (const warning of evaluateDataLossResult.warnings) {
        process.stdout.write(`  • ${warning.message}\n`)
      }
      process.stdout.write('\n') // empty line

      if (!args['--force']) {
        if (!canPrompt()) {
          migrate.stop()
          throw new MigrateDevEnvNonInteractiveError()
        }

        const message = args['--create-only']
          ? 'Are you sure you want to create this migration?'
          : 'Are you sure you want to create and apply this migration?'
        const confirmation = await prompt({
          type: 'confirm',
          name: 'value',
          message,
        })

        if (!confirmation.value) {
          process.stdout.write('Migration cancelled.\n')
          migrate.stop()
          // Return SIGINT exit code to signal that the process was cancelled.
          process.exit(130)
        }
      }
    }

    let migrationName: undefined | string = undefined
    if (evaluateDataLossResult.migrationSteps > 0 || args['--create-only']) {
      const getMigrationNameResult = await getMigrationName(args['--name'])

      if (getMigrationNameResult.userCancelled) {
        process.stdout.write(`${getMigrationNameResult.userCancelled}\n`)
        migrate.stop()
        // Return SIGINT exit code to signal that the process was cancelled.
        process.exit(130)
      } else {
        migrationName = getMigrationNameResult.name
      }
    }

    let migrationIds: string[]
    try {
      const createMigrationResult = await migrate.createMigration({
        migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
        migrationName: migrationName || '',
        draft: !!args['--create-only'],
        schema: toSchemasContainer((await migrate.getPrismaSchema()).schemas),
      })
      debug({ createMigrationResult })

      if (args['--create-only']) {
        migrate.stop()

        return `Prisma Migrate created the following migration without applying it ${printMigrationId(
          createMigrationResult.generatedMigrationName!,
        )}\n\nYou can now edit it and apply it by running ${green(getCommandWithExecutor('prisma migrate dev'))}.`
      }

      const { appliedMigrationNames } = await migrate.applyMigrations()
      migrationIds = appliedMigrationNames
    } finally {
      // Stop engine
      migrate.stop()
    }

    // For display only, empty line
    migrationIdsApplied.length > 0 && process.stdout.write('\n')

    if (migrationIds.length === 0) {
      if (migrationIdsApplied.length > 0) {
        process.stdout.write(`${green('Your database is now in sync with your schema.')}\n`)
      } else {
        process.stdout.write('Already in sync, no schema change or pending migration was found.\n')
      }
    } else {
      process.stdout.write(
        `\nThe following migration(s) have been created and applied from new schema changes:\n\n${printFilesFromMigrationIds(
          'migrations',
          migrationIds,
          {
            'migration.sql': '',
          },
        )}

${green('Your database is now in sync with your schema.')}\n`,
      )
    }

    // Run if not skipped
    if (!process.env.PRISMA_MIGRATE_SKIP_GENERATE && !args['--skip-generate']) {
      await migrate.tryToRunGenerate(datasourceInfo)
      process.stdout.write('\n') // empty line
    }

    // If database was created we want to run the seed if not skipped
    if (wasDbCreated && !process.env.PRISMA_MIGRATE_SKIP_SEED && !args['--skip-seed']) {
      // Run seed if 1 or more seed files are present
      // And catch the error to continue execution
      try {
        const seedCommandFromPkgJson = await getSeedCommandFromPackageJson(process.cwd())

        if (seedCommandFromPkgJson) {
          process.stdout.write('\n') // empty line
          const successfulSeeding = await executeSeedCommand({ commandFromConfig: seedCommandFromPkgJson })
          if (successfulSeeding) {
            process.stdout.write(`\n${process.platform === 'win32' ? '' : '🌱  '}The seed command has been executed.\n`)
          } else {
            process.exit(1)
          }
        } else {
          // Only used to help users to set up their seeds from old way to new package.json config
          const { schemaPath } = (await getSchemaWithPath(args['--schema'], config.schema))!
          // we don't want to output the returned warning message
          // but we still want to run it for `legacyTsNodeScriptWarning()`
          await verifySeedConfigAndReturnMessage(schemaPath)
        }
      } catch (e) {
        console.error(e)
      }
    }

    return ''
  }

  private logResetReason({ datasourceInfo, reason }: { datasourceInfo: DatasourceInfo; reason: string }) {
    // Log the reason of why a reset is needed to the user
    process.stdout.write(`${reason}\n`)

    let message: string

    if (['PostgreSQL', 'SQL Server'].includes(datasourceInfo.prettyProvider!)) {
      if (datasourceInfo.schemas?.length) {
        message = `We need to reset the following schemas: "${datasourceInfo.schemas.join(', ')}"`
      } else if (datasourceInfo.schema) {
        message = `We need to reset the "${datasourceInfo.schema}" schema`
      } else {
        message = 'We need to reset the database schema'
      }
    } else {
      message = `We need to reset the ${datasourceInfo.prettyProvider} database "${datasourceInfo.dbName}"`
    }

    if (datasourceInfo.dbLocation) {
      message += ` at "${datasourceInfo.dbLocation}"`
    }

    process.stdout.write(`${message}\n`)
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red('!'))} ${error}\n${MigrateDev.help}`)
    }
    return MigrateDev.help
  }
}
