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
import { ensureCanConnectToDatabase, getDatasourceInfo } from '../utils/ensureDatabaseExists'
import { getSchemaPathAndPrint } from '../utils/getSchemaPathAndPrint'
import { printDatasource } from '../utils/printDatasource'

export class MigrateResolve implements Command {
  public static new(): MigrateResolve {
    return new MigrateResolve()
  }

  private static help = format(`
Resolve issues with database migrations in deployment databases: 
- recover from failed migrations
- baseline databases when starting to use Prisma Migrate on existing databases
- reconcile hotfixes done manually on databases with your migration history

Run "prisma migrate status" to identify if you need to use resolve.

Read more about resolving migration history issues: ${link('https://pris.ly/d/migrate-resolve')}
 
${bold('Usage')}

  ${dim('$')} prisma migrate resolve [options]
  
${bold('Options')}

    -h, --help   Display this help message
      --schema   Custom path to your Prisma schema
     --applied   Record a specific migration as applied
 --rolled-back   Record a specific migration as rolled back

${bold('Examples')}

  Update migrations table, recording a specific migration as applied 
  ${dim('$')} prisma migrate resolve --applied 20201231000000_add_users_table

  Update migrations table, recording a specific migration as rolled back
  ${dim('$')} prisma migrate resolve --rolled-back 20201231000000_add_users_table

  Specify a schema
  ${dim('$')} prisma migrate resolve --rolled-back 20201231000000_add_users_table --schema=./schema.prisma
`)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        '--applied': String,
        '--rolled-back': String,
        '--schema': String,
        '--telemetry-information': String,
      },
      false,
    )

    if (isError(args)) {
      return this.help(args.message)
    }

    await checkUnsupportedDataProxy('migrate resolve', args, true)

    if (args['--help']) {
      return this.help()
    }

    loadEnvFile(args['--schema'], true)

    const schemaPath = await getSchemaPathAndPrint(args['--schema'])

    printDatasource({ datasourceInfo: await getDatasourceInfo({ schemaPath }) })

    // if both are not defined
    if (!args['--applied'] && !args['--rolled-back']) {
      throw new Error(
        `--applied or --rolled-back must be part of the command like:
${bold(green(getCommandWithExecutor('prisma migrate resolve --applied 20201231000000_example')))}
${bold(green(getCommandWithExecutor('prisma migrate resolve --rolled-back 20201231000000_example')))}`,
      )
    }
    // if both are defined
    else if (args['--applied'] && args['--rolled-back']) {
      throw new Error('Pass either --applied or --rolled-back, not both.')
    }

    if (args['--applied']) {
      if (typeof args['--applied'] !== 'string' || args['--applied'].length === 0) {
        throw new Error(
          `--applied value must be a string like ${bold(
            green(getCommandWithExecutor('prisma migrate resolve --applied 20201231000000_example')),
          )}`,
        )
      }

      await ensureCanConnectToDatabase(schemaPath)

      const migrate = new Migrate(schemaPath)
      try {
        await migrate.markMigrationApplied({
          migrationId: args['--applied'],
        })
      } finally {
        migrate.stop()
      }

      return `Migration ${args['--applied']} marked as applied.`
    } else {
      if (typeof args['--rolled-back'] !== 'string' || args['--rolled-back'].length === 0) {
        throw new Error(
          `--rolled-back value must be a string like ${bold(
            green(getCommandWithExecutor('prisma migrate resolve --rolled-back 20201231000000_example')),
          )}`,
        )
      }

      await ensureCanConnectToDatabase(schemaPath)

      const migrate = new Migrate(schemaPath)
      try {
        await migrate.markMigrationRolledBack({
          migrationId: args['--rolled-back'],
        })
      } finally {
        migrate.stop()
      }

      return `Migration ${args['--rolled-back']} marked as rolled back.`
    }
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${MigrateResolve.help}`)
    }
    return MigrateResolve.help
  }
}
