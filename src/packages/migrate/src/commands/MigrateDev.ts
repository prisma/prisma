import {
  arg,
  Command,
  Commands,
  format,
  HelpError,
  isError,
  getSchemaPath,
  getCommandWithExecutor,
  isCi,
  IntrospectionEngine,
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
import { printMigrationId } from '../utils/printMigrationId'
import { printFilesFromMigrationIds } from '../utils/printFiles'
import {
  handleUnexecutableSteps,
  handleWarnings,
} from '../utils/handleEvaluateDataloss'
import { getMigrationName } from '../utils/promptForMigrationName'
import { isOldMigrate } from '../utils/detectOldMigrate'

const debug = Debug('migrate:dev')

export class MigrateDev implements Command {
  public static new(): MigrateDev {
    return new MigrateDev()
  }

  private static help = format(`${
    process.platform === 'win32' ? '' : chalk.bold('🏋️  ')
  }Migrate your database with confidence

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
    --create-only   Only create a migration without applying it
      -f, --force   Skip the data loss confirmation prompt
  --skip-generate   Skip generate

${chalk.bold('Examples')}

  Specify a schema
  ${chalk.dim(
    '$',
  )} prisma migrate dev --early-access-feature --schema=./schema.prisma

  Create a new migration and apply it
  ${chalk.dim('$')} prisma migrate dev --early-access-feature

  Create a migration without applying it
  ${chalk.dim('$')} prisma migrate dev --early-access-feature --create-only
  `)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--name': String,
      '-n': '--name',
      '--force': Boolean,
      '-f': '--force',
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

    if (schemaPath) {
      const migrationDirPath = path.join(path.dirname(schemaPath), 'migrations')
      if (isOldMigrate(migrationDirPath)) {
        // Maybe add link to docs?
        throw Error(
          `The migrations folder contains migrations files from an older version of Prisma Migrate which is not compatible.
Delete the current migrations folder to continue and read the documentation for how to upgrade / baseline.`,
        )
      }
    }

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

    console.info(
      chalk.dim(
        `Prisma Schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    // Automatically create the database if it doesn't exist
    const wasDbCreated = await ensureDatabaseExists('create', true, schemaPath)
    if (wasDbCreated) {
      console.info()
      console.info(wasDbCreated)
    }

    const migrate = new Migrate(schemaPath)

    if (args['--create-only']) {
      let migrationName: undefined | string = undefined
      const getMigrationNameResult = await getMigrationName(args['--name'])
      if (getMigrationNameResult.userCancelled) {
        migrate.stop()
        return getMigrationNameResult.userCancelled
      } else {
        migrationName = getMigrationNameResult.name
      }

      const migrationId = await migrate.draft({
        name: migrationName,
      })
      migrate.stop()

      return `\nPrisma Migrate created a migration draft ${printMigrationId(
        migrationId,
      )}\n\nYou can now edit it and apply it by running ${chalk.greenBright(
        getCommandWithExecutor('prisma migrate dev --early-access-feature'),
      )}.`
    }

    const diagnoseResult = await migrate.diagnoseMigrationHistory()
    debug({ diagnoseResult })

    let isResetNeeded = false
    let migrationIdsFromDatabaseIsBehind: string[] = []

    if (diagnoseResult.errorInUnappliedMigration) {
      const failedMigrationError = diagnoseResult.errorInUnappliedMigration as UserFacingErrorWithMeta

      throw new Error(
        `The migration ${
          failedMigrationError.meta.migration_name
        } failed when applied to the shadow database.
${chalk.green(
  `Fix the migration script and run ${getCommandWithExecutor(
    'prisma migrate dev --early-access-feature' +
      (args['--force'] ? ' --force' : ''),
  )} again.`,
)}

${failedMigrationError.error_code}
${failedMigrationError.message}`,
      )
    }

    const hasFailedMigrations = diagnoseResult.failedMigrationNames.length > 0
    const hasEditedMigrations = diagnoseResult.editedMigrationNames.length > 0

    // if failed migration(s) or edited migration(s) print and got to reset
    if (hasFailedMigrations || hasEditedMigrations) {
      isResetNeeded = true

      if (hasFailedMigrations) {
        // migration(s), usually one, that failed to apply the the database (which may have data)
        console.info(
          `The following migration(s) failed to apply:\n- ${diagnoseResult.failedMigrationNames.join(
            '\n- ',
          )}\n`,
        )
      }

      if (hasEditedMigrations) {
        // migration(s) that were edited since they were applied to the db.
        console.info(
          `The following migration(s) were edited after they were applied:\n- ${diagnoseResult.editedMigrationNames.join(
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
    'prisma migrate dev --early-access-feature' +
      (args['--force'] ? ' --force' : ''),
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
            const confirmDbPushUsed = await this.confirmDbPushUsed()
            if (confirmDbPushUsed) {
              const introspectEngine = new IntrospectionEngine({
                cwd: path.dirname(schemaPath),
              })

              const introspectResult = await introspectEngine.introspect(
                migrate.getDatamodel(),
              )
              introspectEngine.stop()

              const createMigrationResult = await migrate.createMigration({
                migrationsDirectoryPath: migrate.migrationsDirectoryPath,
                migrationName: '',
                draft: true,
                prismaSchema: introspectResult.datamodel,
              })

              console.info(
                `Migration "${createMigrationResult.generatedMigrationName!}" created.`,
              )

              await migrate.markMigrationApplied({
                migrationId: createMigrationResult.generatedMigrationName!,
              })

              console.info(
                `Migration "${createMigrationResult.generatedMigrationName!}" marked applied.`,
              )

              const createMigrationOptionalResult = await migrate.createMigration(
                {
                  migrationsDirectoryPath: migrate.migrationsDirectoryPath,
                  migrationName: '',
                  draft: false,
                  prismaSchema: migrate.getDatamodel(),
                },
              )

              if (createMigrationOptionalResult.generatedMigrationName) {
                console.info(
                  `Migration "${createMigrationResult.generatedMigrationName!}" created and applied.`,
                )
              }
              migrate.stop()
              return `Operation successful.`
            } else {
              migrate.stop()
              throw Error(
                'Check init flow with introspect + SQL schema dump (TODO docs)',
              )
            }
          } else {
            // we could try to fix the drift in the future
            isResetNeeded = true
          }
        }
      }

      if (diagnoseResult.history) {
        if (diagnoseResult.history.diagnostic === 'databaseIsBehind') {
          const { appliedMigrationNames } = await migrate.applyOnly()
          migrationIdsFromDatabaseIsBehind = appliedMigrationNames
          // Inform user about applied migrations now
          if (migrationIdsFromDatabaseIsBehind.length > 0) {
            console.info(
              `\nPrisma Migrate applied the following unapplied migration(s):\n\n${chalk(
                printFilesFromMigrationIds(
                  'migrations',
                  migrationIdsFromDatabaseIsBehind,
                  {
                    'migration.sql': '',
                  },
                ),
              )}`,
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

    if (isResetNeeded) {
      if (!args['--force']) {
        // We use prompts.inject() for testing in our CI
        if (isCi() && Boolean((prompt as any)._injected?.length) === false) {
          throw Error(
            `Use the --force flag to use the migrate command in an unnattended environment like ${chalk.bold.greenBright(
              getCommandWithExecutor(
                'prisma migrate dev --force --early-access-feature',
              ),
            )}`,
          )
        }

        const confirmedReset = await this.confirmReset(
          await migrate.getDbInfo(),
        )
        if (!confirmedReset) {
          console.info() // empty line
          console.info('Reset cancelled.')
          process.exit(0)
        }
        await migrate.reset()
      }
    }

    const evaluateDataLossResult = await migrate.evaluateDataLoss()

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
    if (evaluateDataLossResult.migrationSteps.length > 0) {
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
      draft: false,
      prismaSchema: migrate.getDatamodel(),
    })
    debug({ createMigrationResult })

    const { appliedMigrationNames: migrationIds } = await migrate.applyOnly()

    migrate.stop()

    if (migrationIds.length === 0) {
      if (migrationIdsFromDatabaseIsBehind?.length > 0) {
        // Run if not skipped
        if (!process.env.MIGRATE_SKIP_GENERATE && !args['--skip-generate']) {
          await migrate.tryToRunGenerate()
        }

        // During databaseIsBehind diagnostic migrations were applied and displayed
        console.info(`\n${chalk.green('Everything is now in sync.')}`)
      } else {
        console.info(
          `\n${chalk.green(
            'Everything is already in sync',
          )} - Prisma Migrate didn't find any schema changes or unapplied migrations.`,
        )
      }
    } else {
      if (migrationIdsFromDatabaseIsBehind?.length > 0) {
        console.info() // empty line
      }

      console.info(
        `Prisma Migrate created and applied the following migration(s) from new schema changes:\n\n${chalk(
          printFilesFromMigrationIds('migrations', migrationIds, {
            'migration.sql': '',
          }),
        )}`,
      )

      // Run if not skipped
      if (!process.env.MIGRATE_SKIP_GENERATE && !args['--skip-generate']) {
        await migrate.tryToRunGenerate()
      }

      console.info(`\n${chalk.green('Everything is now in sync.')}`)
    }

    return ``
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
