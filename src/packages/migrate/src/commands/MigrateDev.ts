import {
  arg,
  Command,
  format,
  HelpError,
  isError,
  getSchemaPath,
  getCommandWithExecutor,
  isCi,
} from '@prisma/sdk'
import Debug from '@prisma/debug'
import chalk from 'chalk'
import prompt from 'prompts'
import path from 'path'
import { Migrate } from '../Migrate'
import { UserFacingErrorWithMeta } from '../types'
import { ensureDatabaseExists } from '../utils/ensureDatabaseExists'
import {
  EarlyAcessFlagError,
  ExperimentalFlagWithNewMigrateError,
} from '../utils/flagErrors'
import { NoSchemaFoundError, EnvNonInteractiveError } from '../utils/errors'
import { printMigrationId } from '../utils/printMigrationId'
import { printFilesFromMigrationIds } from '../utils/printFiles'
import {
  handleUnexecutableSteps,
  handleWarnings,
} from '../utils/handleEvaluateDataloss'
import { getMigrationName } from '../utils/promptForMigrationName'
import { throwUpgradeErrorIfOldMigrate } from '../utils/detectOldMigrate'

const debug = Debug('migrate:dev')

export class MigrateDev implements Command {
  public static new(): MigrateDev {
    return new MigrateDev()
  }

  private static help = format(`${
    process.platform === 'win32' ? '' : chalk.bold('🏋️  ')
  }Create migrations from your Prisma schema, apply them to the database, generate artifacts (Prisma Client)

${chalk.bold.yellow('WARNING')} ${chalk.bold(
    "Prisma's migration functionality is currently in Early Access.",
  )}
${chalk.dim(
  'When using any of the commands below you need to explicitly opt-in via the --early-access-feature flag.',
)}
  
${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma migrate dev [options] --early-access-feature

${chalk.bold('Options')}

       -h, --help   Display this help message
         --schema   Custom path to your Prisma schema
       -n, --name   Name the migration
    --create-only   Only create a migration without applying it
  --skip-generate   Skip generate

${chalk.bold('Examples')}

  Specify a schema
  ${chalk.dim(
    '$',
  )} prisma migrate dev --schema=./schema.prisma --early-access-feature

  Create a new migration and apply it
  ${chalk.dim('$')} prisma migrate dev --early-access-feature

  Create a migration without applying it
  ${chalk.dim('$')} prisma migrate dev --create-only --early-access-feature
  `)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--name': String,
      '-n': '--name',
      // '--force': Boolean,
      // '-f': '--force',
      '--create-only': Boolean,
      '--schema': String,
      '--skip-generate': Boolean,
      '--experimental': Boolean,
      '--early-access-feature': Boolean,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    if (args['--experimental']) {
      throw new ExperimentalFlagWithNewMigrateError()
    }

    if (!args['--early-access-feature']) {
      throw new EarlyAcessFlagError()
    }

    const schemaPath = await getSchemaPath(args['--schema'])

    if (!schemaPath) {
      throw new NoSchemaFoundError()
    }

    console.info(
      chalk.dim(
        `Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    throwUpgradeErrorIfOldMigrate(schemaPath)

    // Automatically create the database if it doesn't exist
    const wasDbCreated = await ensureDatabaseExists('create', true, schemaPath)
    if (wasDbCreated) {
      console.info()
      console.info(wasDbCreated)
    }

    const migrate = new Migrate(schemaPath)

    const diagnoseResult = await migrate.diagnoseMigrationHistory({
      optInToShadowDatabase: true,
    })
    debug({ diagnoseResult })

    let isResetNeeded = false
    let isResetNeededAfterCreate = false
    let migrationIdsFromDatabaseIsBehind: string[] = []
    let migrationIdsFromAfterReset: string[] = []

    if (diagnoseResult.errorInUnappliedMigration) {
      if (diagnoseResult.errorInUnappliedMigration.error_code === 'P3006') {
        const failedMigrationError = diagnoseResult.errorInUnappliedMigration as UserFacingErrorWithMeta

        throw new Error(
          `The migration ${
            failedMigrationError.meta.migration_name
          } failed when applied to the shadow database.
${chalk.green(
  `Fix the migration script and run ${getCommandWithExecutor(
    'prisma migrate dev --early-access-feature',
  )} again.`,
)}

${failedMigrationError.error_code}
${failedMigrationError.message}`,
        )
      } else {
        throw new Error(`${diagnoseResult.errorInUnappliedMigration.error_code}
${diagnoseResult.errorInUnappliedMigration.message}`)
      }
    }

    const hasFailedMigrations = diagnoseResult.failedMigrationNames.length > 0
    const hasModifiedMigrations = diagnoseResult.editedMigrationNames.length > 0

    // if failed migration(s) or modified migration(s) print and got to reset
    if (hasFailedMigrations || hasModifiedMigrations) {
      isResetNeeded = true

      if (hasFailedMigrations) {
        // migration(s), usually one, that failed to apply the the database (which may have data)
        console.info(
          `The following migration(s) failed to apply:\n- ${diagnoseResult.failedMigrationNames.join(
            '\n- ',
          )}\n`,
        )
      }

      if (hasModifiedMigrations) {
        // migration(s) that were modified since they were applied to the db.
        console.info(
          `The following migration(s) were modified after they were applied:\n- ${diagnoseResult.editedMigrationNames.join(
            '\n- ',
          )}\n`,
        )

        if (diagnoseResult.drift?.diagnostic === 'migrationFailedToApply') {
          // Migration has a problem (failed to cleanly apply to a temporary database) and
          // needs to be fixed or the database has a problem (example: incorrect version, missing extension)
          if (diagnoseResult.drift.error.error_code === 'P3006') {
            const failedMigrationError = diagnoseResult.drift
              .error as UserFacingErrorWithMeta

            throw new Error(
              `The migration ${
                failedMigrationError.meta.migration_name
              } failed when applied to the shadow database.
${chalk.green(
  `Fix the migration script and run ${getCommandWithExecutor(
    'prisma migrate dev --early-access-feature',
  )} again.`,
)}
  
${failedMigrationError.error_code}
${failedMigrationError.message}`,
            )
          }
        }
      }
    } else {
      if (diagnoseResult.drift) {
        if (diagnoseResult.drift?.diagnostic === 'migrationFailedToApply') {
          // Migration has a problem (failed to cleanly apply to a temporary database) and
          // needs to be fixed or the database has a problem (example: incorrect version, missing extension)
          throw new Error(
            `A migration failed when applied to the shadow database:

${diagnoseResult.drift.error.error_code}
${diagnoseResult.drift.error.message}`,
          )
        } else if (diagnoseResult.drift.diagnostic === 'driftDetected') {
          if (diagnoseResult.hasMigrationsTable === false) {
            isResetNeededAfterCreate = true
          } else {
            // we could try to fix the drift in the future
            isResetNeeded = true
          }
        }
      }

      if (diagnoseResult.history) {
        if (diagnoseResult.history.diagnostic === 'databaseIsBehind') {
          const { appliedMigrationNames } = await migrate.applyMigrations()
          migrationIdsFromDatabaseIsBehind = appliedMigrationNames
          // Inform user about applied migrations now
          if (migrationIdsFromDatabaseIsBehind.length > 0) {
            console.info(
              `The following unapplied migration(s) have been applied:\n
- ${migrationIdsFromDatabaseIsBehind.join('\n- ')}\n`,
            )
          }
        } else if (
          diagnoseResult.history.diagnostic === 'migrationsDirectoryIsBehind'
        ) {
          isResetNeeded = true
        } else if (diagnoseResult.history.diagnostic === 'historiesDiverge') {
          isResetNeeded = true
          // migration(s) were removed from directory since they were applied to the db.
          console.info(
            `The following migration(s) are applied to the database but missing from the local migrations directory:
- ${diagnoseResult.history.unpersistedMigrationNames.join('\n- ')}\n`,
          )
        }
      }
    }

    if (isResetNeeded && !isResetNeededAfterCreate) {
      if (!args['--force']) {
        // We use prompts.inject() for testing in our CI
        if (isCi() && Boolean((prompt as any)._injected?.length) === false) {
          throw new EnvNonInteractiveError()
        }

        const confirmedReset = await this.confirmReset(
          await migrate.getDbInfo(),
        )
        if (!confirmedReset) {
          console.info() // empty line
          console.info('Reset cancelled.')
          process.exit(0)
          // For snapshot test, because exit() is mocked
          return ``
        }
      }
      await migrate.reset()
      const { appliedMigrationNames } = await migrate.applyMigrations()
      migrationIdsFromAfterReset = appliedMigrationNames
      // Inform user about applied migrations now
      if (migrationIdsFromAfterReset.length > 0) {
        console.info(
          `The following migration(s) have been applied after reset:\n\n${chalk(
            printFilesFromMigrationIds(
              'migrations',
              migrationIdsFromAfterReset,
              {
                'migration.sql': '',
              },
            ),
          )}`,
        )
      }
    }

    const evaluateDataLossResult = await migrate.evaluateDataLoss()
    debug({ evaluateDataLossResult })

    // display unexecutableSteps
    // throw error
    handleUnexecutableSteps(evaluateDataLossResult.unexecutableSteps)

    // log warnings and prompt user to continue if needed
    const userCancelled = await handleWarnings(
      evaluateDataLossResult.warnings,
      args['--force'],
    )
    if (userCancelled) {
      migrate.stop()
      return `Migration cancelled.`
    }

    let migrationName: undefined | string = undefined
    if (
      evaluateDataLossResult.migrationSteps.length > 0 ||
      args['--create-only']
    ) {
      const getMigrationNameResult = await getMigrationName(args['--name'])
      if (getMigrationNameResult.userCancelled) {
        migrate.stop()
        return getMigrationNameResult.userCancelled
      } else {
        migrationName = getMigrationNameResult.name
      }
    }

    const createMigrationResult = await migrate.createMigration({
      migrationsDirectoryPath: migrate.migrationsDirectoryPath,
      migrationName: migrationName || '',
      draft: args['--create-only'] ? true : false,
      prismaSchema: migrate.getDatamodel(),
    })
    debug({ createMigrationResult })

    if (args['--create-only']) {
      migrate.stop()

      console.info() // empty line
      return `Prisma Migrate created the following migration without applying it ${printMigrationId(
        createMigrationResult.generatedMigrationName!,
      )}\n\nYou can now edit it and apply it by running ${chalk.greenBright(
        getCommandWithExecutor('prisma migrate dev --early-access-feature'),
      )}.`
    }

    if (isResetNeededAfterCreate) {
      if (!args['--force']) {
        // We use prompts.inject() for testing in our CI
        if (isCi() && Boolean((prompt as any)._injected?.length) === false) {
          throw new EnvNonInteractiveError()
        }

        const confirmedReset = await this.confirmReset(
          await migrate.getDbInfo(),
        )
        if (!confirmedReset) {
          console.info(
            `The following migration was created from new schema changes:\n\n${chalk(
              printFilesFromMigrationIds(
                'migrations',
                [createMigrationResult.generatedMigrationName!],
                {
                  'migration.sql': '',
                },
              ),
            )}`,
          )
          console.info() // empty line
          console.info('Reset cancelled.')
          process.exit(0)
          // For snapshot test, because exit() is mocked
          return ``
        }
        await migrate.reset()
      }
    }

    const {
      appliedMigrationNames: migrationIds,
    } = await migrate.applyMigrations()

    migrate.stop()

    if (migrationIds.length === 0) {
      if (
        migrationIdsFromAfterReset.length > 0 ||
        migrationIdsFromDatabaseIsBehind.length > 0
      ) {
        // Run if not skipped
        if (!process.env.MIGRATE_SKIP_GENERATE && !args['--skip-generate']) {
          await migrate.tryToRunGenerate()
        }

        // During databaseIsBehind diagnostic migrations were applied and displayed
        console.info() // empty line
        return `${chalk.green('Everything is now in sync.')}`
      } else {
        console.info() // empty line
        return `Already in sync, no schema change or unapplied migration was found.`
      }
    } else {
      // For display only
      if (
        migrationIdsFromAfterReset.length > 0 ||
        migrationIdsFromDatabaseIsBehind.length > 0
      ) {
        console.info() // empty line
      }

      console.info(
        `The following migration(s) have been created and applied from new schema changes:\n\n${chalk(
          printFilesFromMigrationIds('migrations', migrationIds, {
            'migration.sql': '',
          }),
        )}`,
      )

      // Run if not skipped
      if (!process.env.MIGRATE_SKIP_GENERATE && !args['--skip-generate']) {
        await migrate.tryToRunGenerate()
      }

      console.info() // empty line
      return `${chalk.green('Everything is now in sync.')}`
    }
  }

  private async confirmReset({
    schemaWord,
    dbType,
    dbName,
    dbLocation,
  }): Promise<boolean> {
    const confirmation = await prompt({
      type: 'confirm',
      name: 'value',
      message: `We need to reset the ${dbType} ${schemaWord} "${dbName}" at "${dbLocation}". ${chalk.red(
        'All data will be lost',
      )}.\nDo you want to continue?`,
    })

    return confirmation.value
  }

  private async confirmDbPushUsed(): Promise<boolean> {
    const confirmation = await prompt({
      type: 'confirm',
      name: 'value',
      message: `Did you use ${chalk.green('prisma db push')}?`,
    })

    return confirmation.value
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${MigrateDev.help}`,
      )
    }
    return MigrateDev.help
  }
}
