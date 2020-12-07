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
import { NoSchemaFoundError } from '../utils/errors'
import { throwUpgradeErrorIfOldMigrate } from '../utils/detectOldMigrate'
import { printDatasource } from '../utils/printDatasource'
export class MigrateResolve implements Command {
  public static new(): MigrateResolve {
    return new MigrateResolve()
  }

  private static help = format(`
Resolve issues with database migrations (baseline, failed migration, hotfix) in staging/production

${chalk.bold.yellow('WARNING')} ${chalk.bold(
    `Prisma's migration functionality is currently in Preview (${link(
      'https://pris.ly/d/preview',
    )}).`,
  )}
${chalk.dim(
  'When using any of the commands below you need to explicitly opt-in via the --preview-feature flag.',
)}
  
${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma migrate resolve [options] --preview-feature
  
${chalk.bold('Options')}

    -h, --help   Display this help message
      --schema   Custom path to your Prisma schema
     --applied   Mark a migration as applied
  --rolled-back   Mark a migration as rolled back

${chalk.bold('Examples')}

  Mark a migration as applied
  ${chalk.dim(
    '$',
  )} prisma migrate resolve --applied 20201231000000_add_users_table --preview-feature

  Mark a migration as rolled back
  ${chalk.dim(
    '$',
  )} prisma migrate resolve --rolled-back 20201231000000_add_users_table --preview-feature

  Specify a schema
  ${chalk.dim(
    '$',
  )} prisma migrate resolve --rolled-back 20201231000000_add_users_table --schema=./schema.prisma --preview-feature
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

    // if both are not defined
    if (!args['--applied'] && !args['--rolled-back']) {
      throw new Error(
        `--applied or --rolled-back must be part of the command like:
${chalk.bold.green(
  getCommandWithExecutor(
    'prisma migrate resolve --applied 20201231000000_example --preview-feature',
  ),
)}
${chalk.bold.green(
  getCommandWithExecutor(
    'prisma migrate resolve --rolled-back 20201231000000_example --preview-feature',
  ),
)}`,
      )
    }
    // if both are defined
    else if (args['--applied'] && args['--rolled-back']) {
      throw new Error('Pass either --applied or --rolled-back, not both.')
    }

    if (args['--applied']) {
      if (
        typeof args['--applied'] !== 'string' ||
        args['--applied'].length === 0
      ) {
        throw new Error(
          `--applied value must be a string like ${chalk.bold.green(
            getCommandWithExecutor(
              'prisma migrate resolve --applied 20201231000000_example --preview-feature',
            ),
          )}`,
        )
      }

      await ensureCanConnectToDatabase(schemaPath)

      const migrate = new Migrate(schemaPath)

      await migrate.markMigrationApplied({
        migrationId: args['--applied'],
      })
      migrate.stop()

      return `Migration ${args['--applied']} marked as applied.`
    } else {
      if (
        typeof args['--rolled-back'] !== 'string' ||
        args['--rolled-back'].length === 0
      ) {
        throw new Error(
          `--rolled-back value must be a string like ${chalk.bold.green(
            getCommandWithExecutor(
              'prisma migrate resolve --rolled-back 20201231000000_example --preview-feature',
            ),
          )}`,
        )
      }

      await ensureCanConnectToDatabase(schemaPath)

      const migrate = new Migrate(schemaPath)

      await migrate.markMigrationRolledBack({
        migrationId: args['--rolled-back'],
      })
      migrate.stop()

      return `Migration ${args['--rolled-back']} marked as rolled back.`
    }
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${MigrateResolve.help}`,
      )
    }
    return MigrateResolve.help
  }
}
