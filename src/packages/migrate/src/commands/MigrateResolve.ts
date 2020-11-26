import {
  arg,
  Command,
  format,
  getSchemaPath,
  HelpError,
  isError,
  getCommandWithExecutor,
} from '@prisma/sdk'
import chalk from 'chalk'
import path from 'path'
import { ensureCanConnectToDatabase } from '../utils/ensureDatabaseExists'
import { Migrate } from '../Migrate'
import {
  EarlyAcessFlagError,
  ExperimentalFlagWithNewMigrateError,
} from '../utils/flagErrors'
import Debug from '@prisma/debug'
import { isOldMigrate } from '../utils/detectOldMigrate'

const debug = Debug('migrate:resolve')

export class MigrateResolve implements Command {
  public static new(): MigrateResolve {
    return new MigrateResolve()
  }

  private static help = format(`
Resolve issues with database migrations (baseline, failed migration, hotfix) in staging/production

${chalk.bold.yellow('WARNING')} ${chalk.bold(
    "Prisma's migration functionality is currently in Early Access.",
  )}
${chalk.dim(
  'When using any of the commands below you need to explicitly opt-in via the --early-access-feature flag.',
)}
  
${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma migrate resolve [options] --early-access-feature
  
${chalk.bold('Options')}

    -h, --help   Display this help message
      --schema   Custom path to your Prisma schema
     --applied   Mark a migration as applied
  --rolledback   Mark a migration as rolled back

${chalk.bold('Examples')}

  Mark a migration as applied
  ${chalk.dim(
    '$',
  )} prisma migrate resolve --early-access-feature --applied=20201231000000_add_users_table

  Mark a migration as rolled back
  ${chalk.dim(
    '$',
  )} prisma migrate resolve --early-access-feature --rolledback=20201231000000_add_users_table

  Specify a schema
  ${chalk.dim(
    '$',
  )} prisma migrate resolve --early-access-feature --rolledback=20201231000000_add_users_table --schema=./schema.prisma
`)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        '--applied': String,
        '--rolledback': String,
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
    } else {
      console.info(
        chalk.dim(
          `Prisma schema loaded from ${path.relative(
            process.cwd(),
            schemaPath,
          )}`,
        ),
      )

      const migrationDirPath = path.join(path.dirname(schemaPath), 'migrations')
      if (isOldMigrate(migrationDirPath)) {
        // Maybe add link to docs?
        throw Error(
          `The migrations folder contains migrations files from an older version of Prisma Migrate which is not compatible.
  Delete the current migrations folder to continue and read the documentation for how to upgrade / baseline.`,
        )
      }
    }

    // if both are not defined
    if (!args['--applied'] && !args['--rolledback']) {
      throw new Error(
        `--applied or --rolledback must be part of the command like ${chalk.bold.green(
          getCommandWithExecutor(
            'prisma migrate resolve --early-access-feature --applied="20201231000000_example"',
          ),
        )}`,
      )
    }
    // if both are defined
    else if (args['--applied'] && args['--rolledback']) {
      throw new Error('Pass either --applied or --rolledback, not both.')
    }

    if (args['--applied']) {
      if (
        typeof args['--applied'] !== 'string' ||
        args['--applied'].length === 0
      ) {
        throw new Error(
          `--applied value must be a string like ${chalk.bold.green(
            getCommandWithExecutor(
              'prisma migrate resolve --early-access-feature --applied="20201231000000_example"',
            ),
          )}`,
        )
      }

      await ensureCanConnectToDatabase(schemaPath)

      const migrate = new Migrate(schemaPath)

      await migrate.markMigrationApplied({
        migrationId: args['--applied'],
        expectFailed: true,
      })
      migrate.stop()

      return `Migration ${args['--applied']} marked as applied.`
    } else {
      if (
        typeof args['--rolledback'] !== 'string' ||
        args['--rolledback'].length === 0
      ) {
        throw new Error(
          `--rolledback value must be a string like ${chalk.bold.green(
            getCommandWithExecutor(
              'prisma migrate resolve --early-access-feature --rolledback="20201231000000_example"',
            ),
          )}`,
        )
      }

      await ensureCanConnectToDatabase(schemaPath)

      const migrate = new Migrate(schemaPath)

      await migrate.markMigrationRolledBack({
        migrationId: args['--rolledback'],
      })
      migrate.stop()

      return `Migration ${args['--rolledback']} marked as rolled back.`
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
