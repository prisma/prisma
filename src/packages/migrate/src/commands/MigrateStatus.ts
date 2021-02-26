import {
  arg,
  Command,
  format,
  getSchemaPath,
  HelpError,
  isError,
  getCommandWithExecutor,
  link,
} from '@prisma/sdk'
import chalk from 'chalk'
import path from 'path'
import { ensureCanConnectToDatabase } from '../utils/ensureDatabaseExists'
import { Migrate } from '../Migrate'
import {
  PreviewFlagError,
  ExperimentalFlagWithNewMigrateError,
  EarlyAccessFeatureFlagWithNewMigrateError,
} from '../utils/flagErrors'
import { HowToBaselineError, NoSchemaFoundError } from '../utils/errors'
import Debug from '@prisma/debug'
import { throwUpgradeErrorIfOldMigrate } from '../utils/detectOldMigrate'
import { printDatasource } from '../utils/printDatasource'

const debug = Debug('prisma:migrate:status')

export class MigrateStatus implements Command {
  public static new(): MigrateStatus {
    return new MigrateStatus()
  }

  private static help = format(`
Check the status of your database migrations

${chalk.bold.yellow('WARNING')} ${chalk.bold(
    `Prisma's migration functionality is currently in Preview (${link(
      'https://pris.ly/d/preview',
    )}).`,
  )}
  ${chalk.dim(
    'When using any of the commands below you need to explicitly opt-in via the --preview-feature flag.',
  )}
  
  ${chalk.bold('Usage')}

    ${chalk.dim('$')} prisma migrate status [options] --preview-feature
    
  ${chalk.bold('Options')}

          -h, --help   Display this help message
            --schema   Custom path to your Prisma schema

  ${chalk.bold('Examples')}

  Check the status of your database migrations
  ${chalk.dim('$')} prisma migrate status --preview-feature

  Specify a schema
  ${chalk.dim(
    '$',
  )} prisma migrate status --schema=./schema.prisma --preview-feature
`)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        '--experimental': Boolean,
        '--preview-feature': Boolean,
        '--early-access-feature': Boolean,
        '--schema': String,
        '--telemetry-information': String,
      },
      false,
    )

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    if (args['--experimental']) {
      throw new ExperimentalFlagWithNewMigrateError()
    }

    if (args['--early-access-feature']) {
      throw new EarlyAccessFeatureFlagWithNewMigrateError()
    }

    if (!args['--preview-feature']) {
      throw new PreviewFlagError()
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

    await printDatasource(schemaPath)

    throwUpgradeErrorIfOldMigrate(schemaPath)

    const migrate = new Migrate(schemaPath)

    try {
      await ensureCanConnectToDatabase(schemaPath)
    } catch (e) {
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

    const diagnoseResult = await migrate.diagnoseMigrationHistory({
      optInToShadowDatabase: false,
    })
    debug({ diagnoseResult: JSON.stringify(diagnoseResult, null, 2) })
    const listMigrationDirectoriesResult = await migrate.listMigrationDirectories()
    debug({ listMigrationDirectoriesResult })
    migrate.stop()

    console.log() // empty line

    if (listMigrationDirectoriesResult.migrations.length > 0) {
      const migrations = listMigrationDirectoriesResult.migrations
      console.info(
        `${migrations.length} migration${
          migrations.length > 1 ? 's' : ''
        } found in prisma/migrations\n`,
      )
    } else {
      console.info(`No migration found in prisma/migrations\n`)
    }

    let unappliedMigrations: string[] = []
    if (diagnoseResult.history?.diagnostic === 'databaseIsBehind') {
      unappliedMigrations = diagnoseResult.history.unappliedMigrationNames
      console.info(
        `Following migration${
          unappliedMigrations.length > 1 ? 's' : ''
        } have not yet been applied:
${unappliedMigrations.join('\n')}

To apply migrations in development run ${chalk.bold.greenBright(
          getCommandWithExecutor(`prisma migrate dev --preview-feature`),
        )}.
To apply migrations in production run ${chalk.bold.greenBright(
          getCommandWithExecutor(`prisma migrate deploy --preview-feature`),
        )}.`,
      )
    } else if (diagnoseResult.history?.diagnostic === 'historiesDiverge') {
      return `Your local migration history and the migrations table from your database are different:

The last common migration is: ${diagnoseResult.history.lastCommonMigrationName}

The migration${
        diagnoseResult.history.unappliedMigrationNames.length > 1 ? 's' : ''
      } have not yet been applied:
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
${chalk.bold.greenBright(
  getCommandWithExecutor(
    `prisma migrate resolve --applied "${migrationId}" --preview-feature`,
  ),
)}

Read more about how to baseline an existing production database:
https://pris.ly/d/migrate-baseline`
      }
    } else if (diagnoseResult.failedMigrationNames.length > 0) {
      //         - This is the **recovering from a partially failed migration** case.
      //         - Look at `drift.DriftDetected.rollback`. If present: display the rollback script
      //         - Inform the user that they can "close the case" and mark the failed migration as fixed by calling `prisma migrate resolve`.
      //             - `prisma migrate resolve --rolled-back <migration-name>` if the migration was rolled back
      //             - `prisma migrate resolve --applied <migration-name>` if the migration was rolled forward (and completed successfully)
      const failedMigrations = diagnoseResult.failedMigrationNames

      console.info(
        `Following migration${
          failedMigrations.length > 1 ? 's' : ''
        } have failed:
${failedMigrations.join('\n')}

During development if the failed migration(s) have not been deployed to a production database you can then fix the migration(s) and run ${chalk.bold.greenBright(
          getCommandWithExecutor(`prisma migrate dev --preview-feature`),
        )}.\n`,
      )

      if (
        diagnoseResult.drift?.diagnostic === 'driftDetected' &&
        diagnoseResult.drift.rollback
      ) {
        console.info(`Prisma Migrate generated a script to do a manual rollback
${chalk.grey(diagnoseResult.drift.rollback)}`)
      }

      return `The failed migration(s) can be marked as rolled back or applied:
      
- If you rolled back the migration(s) manually:
${chalk.bold.greenBright(
  getCommandWithExecutor(
    `prisma migrate resolve --rolled-back "${failedMigrations[0]}" --preview-feature`,
  ),
)}

- If you fixed the database manually (hotfix):
${chalk.bold.greenBright(
  getCommandWithExecutor(
    `prisma migrate resolve --applied "${failedMigrations[0]}" --preview-feature`,
  ),
)}

Read more about how to resolve migration issues in a production database:
https://pris.ly/d/migrate-resolve`
    } else if (
      diagnoseResult.drift?.diagnostic === 'driftDetected' &&
      diagnoseResult.history?.diagnostic === 'databaseIsBehind'
    ) {
      //         - Display the rollback script as an account of the contents of the drift.
      //         - Inform the user about scenarios
      //             - *User wants the changes in their local history:* tell the user they can reintrospect and call prisma migrate to create a new migration matching the detected changes
      //             - *User committed the changes in a migration and applied them outside of prisma migrate:* mark a migration that isn't applied yet as applied (hotfix case).
      //                 - Say they may want to `prisma migrate resolve --applied <migration-name>`, where `migration-name` is one of the migrations in `unappliedMigrations` in the `diagnoseMigrationHistory` result.

      const migrationId = diagnoseResult.history.unappliedMigrationNames

      return `The current database schema is not in sync with your Prisma schema.
This is the script to roll back manually:
${chalk.grey(diagnoseResult.drift.rollback)}

You have 2 options

1. To keep the database structure change run: 
- ${chalk.bold.greenBright(
        getCommandWithExecutor('prisma db pull'),
      )} to update your schema with the change.
- ${chalk.bold.greenBright(
        getCommandWithExecutor('prisma migrate dev --preview-feature'),
      )} to create a new migration matching the change.
      
2. You corrected the change in a migration but applied it to the database without using Migrate (hotfix):
- ${chalk.bold.greenBright(
        getCommandWithExecutor(
          `prisma migrate resolve --applied "${migrationId}" --preview-feature`,
        ),
      )} to create a new migration matching the change.`
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
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${MigrateStatus.help}`,
      )
    }
    return MigrateStatus.help
  }
}
