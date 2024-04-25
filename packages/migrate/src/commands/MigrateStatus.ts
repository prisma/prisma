import Debug from '@prisma/debug'
import {
  arg,
  checkUnsupportedDataProxy,
  Command,
  format,
  getCommandWithExecutor,
  HelpError,
  isError,
  link,
  loadEnvFile,
} from '@prisma/internals'
import { bold, dim, green, red } from 'kleur/colors'

import { Migrate } from '../Migrate'
import type { EngineResults } from '../types'
import { ensureCanConnectToDatabase, getDatasourceInfo } from '../utils/ensureDatabaseExists'
import { getSchemaPathAndPrint } from '../utils/getSchemaPathAndPrint'
import { printDatasource } from '../utils/printDatasource'

const debug = Debug('prisma:migrate:status')

export class MigrateStatus implements Command {
  public static new(): MigrateStatus {
    return new MigrateStatus()
  }

  private static help = format(`
Check the status of your database migrations

  ${bold('Usage')}

    ${dim('$')} prisma migrate status [options]
    
  ${bold('Options')}

  -h, --help   Display this help message
    --schema   Custom path to your Prisma schema

  ${bold('Examples')}

  Check the status of your database migrations
  ${dim('$')} prisma migrate status

  Specify a schema
  ${dim('$')} prisma migrate status --schema=./schema.prisma
`)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
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

    loadEnvFile({ schemaPath: args['--schema'], printMessage: true })

    const schemaPath = await getSchemaPathAndPrint(args['--schema'])

    printDatasource({ datasourceInfo: await getDatasourceInfo({ schemaPath }) })

    const migrate = new Migrate(schemaPath)

    await ensureCanConnectToDatabase(schemaPath)

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

    process.stdout.write('\n') // empty line

    if (listMigrationDirectoriesResult.migrations.length > 0) {
      const migrations = listMigrationDirectoriesResult.migrations
      process.stdout.write(
        `${migrations.length} migration${migrations.length > 1 ? 's' : ''} found in prisma/migrations\n`,
      )
    } else {
      process.stdout.write(`No migration found in prisma/migrations\n`)
    }

    let unappliedMigrations: string[] = []
    if (diagnoseResult.history?.diagnostic === 'databaseIsBehind') {
      unappliedMigrations = diagnoseResult.history.unappliedMigrationNames
      process.stdout.write(
        `Following migration${unappliedMigrations.length > 1 ? 's' : ''} have not yet been applied:
${unappliedMigrations.join('\n')}

To apply migrations in development run ${bold(green(getCommandWithExecutor(`prisma migrate dev`)))}.
To apply migrations in production run ${bold(green(getCommandWithExecutor(`prisma migrate deploy`)))}.\n`,
      )
      // Exit 1 to signal that the status is not in sync
      process.exit(1)
    } else if (diagnoseResult.history?.diagnostic === 'historiesDiverge') {
      console.error(`Your local migration history and the migrations table from your database are different:

The last common migration is: ${diagnoseResult.history.lastCommonMigrationName}

The migration${diagnoseResult.history.unappliedMigrationNames.length > 1 ? 's' : ''} have not yet been applied:
${diagnoseResult.history.unappliedMigrationNames.join('\n')}

The migration${
        diagnoseResult.history.unpersistedMigrationNames.length > 1 ? 's' : ''
      } from the database are not found locally in prisma/migrations:
${diagnoseResult.history.unpersistedMigrationNames.join('\n')}`)
      // Exit 1 to signal that the status is not in sync
      process.exit(1)
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
        console.error(`The current database is not managed by Prisma Migrate.
        
Read more about how to baseline an existing production database:
${link('https://pris.ly/d/migrate-baseline')}`)
        // Exit 1 to signal that the status is not in sync
        process.exit(1)
      } else {
        const migrationId = listMigrationDirectoriesResult.migrations.shift() as string
        console.error(`The current database is not managed by Prisma Migrate.

If you want to keep the current database structure and data and create new migrations, baseline this database with the migration "${migrationId}":
${bold(green(getCommandWithExecutor(`prisma migrate resolve --applied "${migrationId}"`)))}

Read more about how to baseline an existing production database:
https://pris.ly/d/migrate-baseline`)
        // Exit 1 to signal that the status is not in sync
        process.exit(1)
      }
    } else if (diagnoseResult.failedMigrationNames.length > 0) {
      //         - This is the **recovering from a partially failed migration** case.
      //         - Inform the user that they can "close the case" and mark the failed migration as fixed by calling `prisma migrate resolve`.
      //             - `prisma migrate resolve --rolled-back <migration-name>` if the migration was rolled back
      //             - `prisma migrate resolve --applied <migration-name>` if the migration was rolled forward (and completed successfully)
      const failedMigrations = diagnoseResult.failedMigrationNames

      console.error(
        `Following migration${failedMigrations.length > 1 ? 's' : ''} have failed:
${failedMigrations.join('\n')}

During development if the failed migration(s) have not been deployed to a production database you can then fix the migration(s) and run ${bold(
          green(getCommandWithExecutor(`prisma migrate dev`)),
        )}.\n`,
      )

      console.error(`The failed migration(s) can be marked as rolled back or applied:
      
- If you rolled back the migration(s) manually:
${bold(green(getCommandWithExecutor(`prisma migrate resolve --rolled-back "${failedMigrations[0]}"`)))}

- If you fixed the database manually (hotfix):
${bold(green(getCommandWithExecutor(`prisma migrate resolve --applied "${failedMigrations[0]}"`)))}

Read more about how to resolve migration issues in a production database:
${link('https://pris.ly/d/migrate-resolve')}`)

      // Exit 1 to signal that the status is not in sync
      process.exit(1)
    } else {
      process.stdout.write('\n') // empty line
      if (unappliedMigrations.length === 0) {
        // Exit 0 to signal that the status is in sync
        return `Database schema is up to date!`
      }
    }

    // Only needed for the return type to match
    return ''
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${MigrateStatus.help}`)
    }
    return MigrateStatus.help
  }
}
