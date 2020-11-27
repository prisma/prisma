import {
  arg,
  Command,
  format,
  getSchemaPath,
  HelpError,
  isError,
  canConnectToDatabase,
  getCommandWithExecutor,
} from '@prisma/sdk'
import chalk from 'chalk'
import prompt from 'prompts'
import path from 'path'
import { ensureCanConnectToDatabase } from '../utils/ensureDatabaseExists'
import { Migrate } from '../Migrate'
import {
  EarlyAcessFlagError,
  ExperimentalFlagWithNewMigrateError,
} from '../utils/flagErrors'
import { printFilesFromMigrationIds } from '../utils/printFiles'
import Debug from '@prisma/debug'
import { isOldMigrate } from '../utils/detectOldMigrate'

const debug = Debug('migrate:status')

export class MigrateStatus implements Command {
  public static new(): MigrateStatus {
    return new MigrateStatus()
  }

  private static help = format(`
  Check the status of your database migrations in staging/production

  ${chalk.bold.yellow('WARNING')} ${chalk.bold(
    "Prisma's migration functionality is currently in Early Access.",
  )}
  ${chalk.dim(
    'When using any of the commands below you need to explicitly opt-in via the --early-access-feature flag.',
  )}
  
  ${chalk.bold('Usage')}

    ${chalk.dim('$')} prisma migrate status [options] --early-access-feature
    
  ${chalk.bold('Options')}

          -h, --help   Display this help message
            --schema   Custom path to your Prisma schema

  ${chalk.bold('Examples')}

  Check the status of your database migrations
  ${chalk.dim('$')} prisma migrate status --early-access-feature

  Specify a schema
  ${chalk.dim(
    '$',
  )} prisma migrate status --schema=./schema.prisma --early-access-feature
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
        `Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    const migrate = new Migrate(schemaPath)

    await ensureCanConnectToDatabase(schemaPath)

    // This is a *read-only* command (modulo shadow database).
    // - ↩️ **RPC**: ****`diagnoseMigrationHistory`, then four cases based on the response.
    //     4. Otherwise, there is no problem migrate is aware of. We could still display:
    //         - Which migrations have been edited since applied (maybe too noisy)
    //         - Pending migrations (those in the migrations folder that haven't been applied yet)
    //         - If there are no pending migrations, tell the user everything looks OK and up to date.

    const diagnoseResult = await migrate.diagnoseMigrationHistory()
    debug({ diagnoseResult })
    const listMigrationDirectoriesResult = await migrate.listMigrationDirectories()
    debug({ listMigrationDirectoriesResult })
    migrate.stop()

    console.info(`\nStatus`)

    if (listMigrationDirectoriesResult.migrations.length > 0) {
      console.info(
        `- ${listMigrationDirectoriesResult.migrations.length} migration${
          listMigrationDirectoriesResult.migrations.length > 1 ? 's' : ''
        }`,
      )
    } else {
      console.info(`- No migration found`)
    }

    if (diagnoseResult.editedMigrationNames.length > 0) {
      console.info(
        `- ${diagnoseResult.editedMigrationNames.length} edited migration${
          diagnoseResult.editedMigrationNames.length > 1 ? 's' : ''
        }: ${diagnoseResult.editedMigrationNames.join(' ,')}`,
      )
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
        // TODO
        throw Error(
          'Check init flow with introspect + SQL schema dump (TODO docs)',
        )
      } else {
        const migrationId = listMigrationDirectoriesResult.migrations.shift() as string
        return `The current database is not managed by Prisma Migrate.

If you want to keep the current database structure and data and create new migrations, baseline this database with the migration "${migrationId}":
${chalk.bold.greenBright(
  getCommandWithExecutor(
    `prisma migrate resolve --applied "${migrationId}" --early-access-feature`,
  ),
)}`
      }
    } else if (diagnoseResult.failedMigrationNames.length > 0) {
      //         - This is the **recovering from a partially failed migration** case.
      //         - Look at `drift.DriftDetected.rollback`. If present: display the rollback script
      //         - Inform the user that they can "close the case" and mark the failed migration as fixed by calling `prisma migrate resolve`.
      //             - `prisma migrate resolve --rolledback <migration-name>` if the migration was rolled back
      //             - `prisma migrate resolve --applied <migration-name>` if the migration was rolled forward (and completed successfully)

      console.info(
        `- ${diagnoseResult.failedMigrationNames.length} failed migration${
          diagnoseResult.failedMigrationNames.length > 1 ? 's' : ''
        }: ${diagnoseResult.failedMigrationNames.join(' ,')}\n`,
      )

      if (
        diagnoseResult.drift?.diagnostic === 'driftDetected' &&
        diagnoseResult.drift.rollback
      ) {
        console.info(`Prisma Migrate generated a script to do a manual rollback
${chalk.grey(diagnoseResult.drift.rollback)}`)
      }

      const migrationId = diagnoseResult.failedMigrationNames[0]

      return `The failed migration(s) can be marked as rolled back or applied:
      
- If you rolled back the migration(s) manually:
${chalk.bold.greenBright(
  getCommandWithExecutor(
    `prisma migrate resolve --rolledback "${migrationId}" --early-access-feature`,
  ),
)}

- If you fixed the database manually (hotfix):
${chalk.bold.greenBright(
  getCommandWithExecutor(
    `prisma migrate resolve --applied "${migrationId}" --early-access-feature`,
  ),
)}`
    } else if (
      diagnoseResult.drift?.diagnostic === 'driftDetected' &&
      (diagnoseResult.history?.diagnostic === 'databaseIsBehind' ||
        diagnoseResult.history?.diagnostic === 'historiesDiverge')
    ) {
      //         - Display the rollback script as an account of the contents of the drift.
      //         - Inform the user about scenarios
      //             - *User wants the changes in their local history:* tell the user they can reintrospect and call prisma migrate to create a new migration matching the detected changes
      //             - *User committed the changes in a migration and applied them outside of prisma migrate:* mark a migration that isn't applied yet as applied (hotfix case).
      //                 - Say they may want to `prisma migrate resolve --applied <migration-name>`, where `migration-name` is one of the migrations in `unappliedMigrations` in the `diagnoseMigrationHistory` result.

      const migrationId = diagnoseResult.history.unappliedMigrationNames

      return `Prisma Migrate detected that the current database structure is not in sync with your Prisma schema.
This is the script to roll back manually:
${chalk.grey(diagnoseResult.drift.rollback)}

You have 2 options

1. To keep the database structure change run: 
- ${chalk.bold.greenBright(
        getCommandWithExecutor('prisma introspect --early-access-feature'),
      )} to update your schema with the change.
- ${chalk.bold.greenBright(
        getCommandWithExecutor('prisma migrate dev --early-access-feature'),
      )} to create a new migration matching the change.
      
2. You corrected the change in a migration but applied it to the database without using Migrate (hotfix):
- ${chalk.bold.greenBright(
        getCommandWithExecutor(
          `prisma migrate resolve --applied "${migrationId}" --early-access-feature`,
        ),
      )} to create a new migration matching the drift.`
    } else {
      console.info() // empty line
      return `No problem detected.`
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
