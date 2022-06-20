import Debug from '@prisma/debug'
import {
  arg,
  checkUnsupportedDataProxy,
  Command,
  format,
  getCommandWithExecutor,
  HelpError,
  isError,
  loadEnvFile,
} from '@prisma/internals'
import chalk from 'chalk'

import { Migrate } from '../Migrate'
import type { EngineResults } from '../types'
import { throwUpgradeErrorIfOldMigrate } from '../utils/detectOldMigrate'
import { ensureCanConnectToDatabase } from '../utils/ensureDatabaseExists'
import { HowToBaselineError } from '../utils/errors'
import { EarlyAccessFeatureFlagWithMigrateError, ExperimentalFlagWithMigrateError } from '../utils/flagErrors'
import { getSchemaPathAndPrint } from '../utils/getSchemaPathAndPrint'
import { printDatasource } from '../utils/printDatasource'

const debug = Debug('prisma:migrate:status')

export class MigrateStatus implements Command {
  public static new(): MigrateStatus {
    return new MigrateStatus()
  }

  private static help = format(`
Check the status of your database migrations

  ${chalk.bold('Usage')}

    ${chalk.dim('$')} prisma migrate status [options]
    
  ${chalk.bold('Options')}

  -h, --help   Display this help message
    --schema   Custom path to your Prisma schema

  ${chalk.bold('Examples')}

  Check the status of your database migrations
  ${chalk.dim('$')} prisma migrate status

  Specify a schema
  ${chalk.dim('$')} prisma migrate status --schema=./schema.prisma
`)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        '--experimental': Boolean,
        '--early-access-feature': Boolean,
        '--schema': String,
        '--telemetry-information': String,
      },
      false,
    )

    if (isError(args)) {
      return this.help(args.message)
    }

    await checkUnsupportedDataProxy('migrate status', args, true)

    if (args['--help']) {
      return this.help()
    }

    if (args['--experimental']) {
      throw new ExperimentalFlagWithMigrateError()
    }

    if (args['--early-access-feature']) {
      throw new EarlyAccessFeatureFlagWithMigrateError()
    }

    loadEnvFile(args['--schema'], true)

    const schemaPath = await getSchemaPathAndPrint(args['--schema'])

    await printDatasource(schemaPath)

    throwUpgradeErrorIfOldMigrate(schemaPath)

    const migrate = new Migrate(schemaPath)

    try {
      await ensureCanConnectToDatabase(schemaPath)
    } catch (e: any) {
      console.info() // empty line
      return chalk.red(`Database connection error:

${e.message}`)
    }

    // This is a *read-only* command (modulo shadow database).
    // - ↩️ **RPC**: ****`diagnoseMigrationHistory`, then four cases based on the response.
    //     4. Otherwise, there is no problem migrate is aware of. We could still display:
    //         - Modified since applied only relevant when using dev, they are ignored for deploy
    //         - Pending migrations (those in the migrations folder that haven't been applied yet)
    //         - If there are no pending migrations, tell the user everything looks OK and up to date.

    let diagnoseResult: EngineResults.DiagnoseMigrationHistoryOutput
    let listMigrationDirectoriesResult: EngineResults.ListMigrationDirectoriesOutput

    try {
      diagnoseResult = await migrate.diagnoseMigrationHistory({
        optInToShadowDatabase: false,
      })
      debug({ diagnoseResult: JSON.stringify(diagnoseResult, null, 2) })

      listMigrationDirectoriesResult = await migrate.listMigrationDirectories()
      debug({ listMigrationDirectoriesResult })
    } finally {
      migrate.stop()
    }

    console.log() // empty line

    if (listMigrationDirectoriesResult.migrations.length > 0) {
      const migrations = listMigrationDirectoriesResult.migrations
      console.info(`${migrations.length} migration${migrations.length > 1 ? 's' : ''} found in prisma/migrations\n`)
    } else {
      console.info(`No migration found in prisma/migrations\n`)
    }

    let unappliedMigrations: string[] = []
    if (diagnoseResult.history?.diagnostic === 'databaseIsBehind') {
      unappliedMigrations = diagnoseResult.history.unappliedMigrationNames
      console.info(
        `Following migration${unappliedMigrations.length > 1 ? 's' : ''} have not yet been applied:
${unappliedMigrations.join('\n')}

To apply migrations in development run ${chalk.bold.greenBright(getCommandWithExecutor(`prisma migrate dev`))}.
To apply migrations in production run ${chalk.bold.greenBright(getCommandWithExecutor(`prisma migrate deploy`))}.`,
      )
    } else if (diagnoseResult.history?.diagnostic === 'historiesDiverge') {
      return `Your local migration history and the migrations table from your database are different:

The last common migration is: ${diagnoseResult.history.lastCommonMigrationName}

The migration${diagnoseResult.history.unappliedMigrationNames.length > 1 ? 's' : ''} have not yet been applied:
${diagnoseResult.history.unappliedMigrationNames.join('\n')}

The migration${
        diagnoseResult.history.unpersistedMigrationNames.length > 1 ? 's' : ''
      } from the database are not found locally in prisma/migrations:
${diagnoseResult.history.unpersistedMigrationNames.join('\n')}`
    }

    if (!diagnoseResult.hasMigrationsTable) {
      //         - This is the **baselining** case.
      //         - Look at the migrations in the migrations folder
      //             - There is no local migration
      //                 - ...and there is drift: the user is coming from db push or another migration tool.
      //                 - Guide the user to an init flow with introspect + SQL schema dump (optionally)
      //             - There are local migrations
      //                 - ↩️ **RPC** `listMigrationDirectories` ****Take the first (=oldest) migration.
      //                 - Suggest calling `prisma migrate resolve --applied <migration-name>`

      if (listMigrationDirectoriesResult.migrations.length === 0) {
        return new HowToBaselineError().message
      } else {
        const migrationId = listMigrationDirectoriesResult.migrations.shift() as string
        return `The current database is not managed by Prisma Migrate.

If you want to keep the current database structure and data and create new migrations, baseline this database with the migration "${migrationId}":
${chalk.bold.greenBright(getCommandWithExecutor(`prisma migrate resolve --applied "${migrationId}"`))}

Read more about how to baseline an existing production database:
https://pris.ly/d/migrate-baseline`
      }
    } else if (diagnoseResult.failedMigrationNames.length > 0) {
      //         - This is the **recovering from a partially failed migration** case.
      //         - Inform the user that they can "close the case" and mark the failed migration as fixed by calling `prisma migrate resolve`.
      //             - `prisma migrate resolve --rolled-back <migration-name>` if the migration was rolled back
      //             - `prisma migrate resolve --applied <migration-name>` if the migration was rolled forward (and completed successfully)
      const failedMigrations = diagnoseResult.failedMigrationNames

      console.info(
        `Following migration${failedMigrations.length > 1 ? 's' : ''} have failed:
${failedMigrations.join('\n')}

During development if the failed migration(s) have not been deployed to a production database you can then fix the migration(s) and run ${chalk.bold.greenBright(
          getCommandWithExecutor(`prisma migrate dev`),
        )}.\n`,
      )

      return `The failed migration(s) can be marked as rolled back or applied:
      
- If you rolled back the migration(s) manually:
${chalk.bold.greenBright(getCommandWithExecutor(`prisma migrate resolve --rolled-back "${failedMigrations[0]}"`))}

- If you fixed the database manually (hotfix):
${chalk.bold.greenBright(getCommandWithExecutor(`prisma migrate resolve --applied "${failedMigrations[0]}"`))}

Read more about how to resolve migration issues in a production database:
https://pris.ly/d/migrate-resolve`
    } else {
      console.info() // empty line
      if (unappliedMigrations.length > 0) {
        // state is not up to date
        return ``
      } else {
        return `Database schema is up to date!`
      }
    }
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${MigrateStatus.help}`)
    }
    return MigrateStatus.help
  }
}
