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
} from '@prisma/sdk'
import chalk from 'chalk'

import { Migrate } from '../Migrate'
import { throwUpgradeErrorIfOldMigrate } from '../utils/detectOldMigrate'
import { ensureCanConnectToDatabase } from '../utils/ensureDatabaseExists'
import { EarlyAccessFeatureFlagWithMigrateError, ExperimentalFlagWithMigrateError } from '../utils/flagErrors'
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
 
${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma migrate resolve [options]
  
${chalk.bold('Options')}

    -h, --help   Display this help message
      --schema   Custom path to your Prisma schema
     --applied   Record a specific migration as applied
 --rolled-back   Record a specific migration as rolled back

${chalk.bold('Examples')}

  Update migrations table, recording a specific migration as applied 
  ${chalk.dim('$')} prisma migrate resolve --applied 20201231000000_add_users_table

  Update migrations table, recording a specific migration as rolled back
  ${chalk.dim('$')} prisma migrate resolve --rolled-back 20201231000000_add_users_table

  Specify a schema
  ${chalk.dim('$')} prisma migrate resolve --rolled-back 20201231000000_add_users_table --schema=./schema.prisma
`)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        '--applied': String,
        '--rolled-back': String,
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

    await checkUnsupportedDataProxy('migrate resolve', args, true)

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

    // if both are not defined
    if (!args['--applied'] && !args['--rolled-back']) {
      throw new Error(
        `--applied or --rolled-back must be part of the command like:
${chalk.bold.green(getCommandWithExecutor('prisma migrate resolve --applied 20201231000000_example'))}
${chalk.bold.green(getCommandWithExecutor('prisma migrate resolve --rolled-back 20201231000000_example'))}`,
      )
    }
    // if both are defined
    else if (args['--applied'] && args['--rolled-back']) {
      throw new Error('Pass either --applied or --rolled-back, not both.')
    }

    if (args['--applied']) {
      if (typeof args['--applied'] !== 'string' || args['--applied'].length === 0) {
        throw new Error(
          `--applied value must be a string like ${chalk.bold.green(
            getCommandWithExecutor('prisma migrate resolve --applied 20201231000000_example'),
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
          `--rolled-back value must be a string like ${chalk.bold.green(
            getCommandWithExecutor('prisma migrate resolve --rolled-back 20201231000000_example'),
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
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${MigrateResolve.help}`)
    }
    return MigrateResolve.help
  }
}
