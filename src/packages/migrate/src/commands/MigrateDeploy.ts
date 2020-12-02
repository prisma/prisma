import {
  arg,
  Command,
  format,
  getSchemaPath,
  HelpError,
  isError,
} from '@prisma/sdk'
import chalk from 'chalk'
import path from 'path'
import { Migrate } from '../Migrate'
import { ensureDatabaseExists } from '../utils/ensureDatabaseExists'
import {
  EarlyAcessFlagError,
  ExperimentalFlagWithNewMigrateError,
} from '../utils/flagErrors'
import { NoSchemaFoundError } from '../utils/errors'
import { printFilesFromMigrationIds } from '../utils/printFiles'
import { throwUpgradeErrorIfOldMigrate } from '../utils/detectOldMigrate'

export class MigrateDeploy implements Command {
  public static new(): MigrateDeploy {
    return new MigrateDeploy()
  }

  private static help = format(`
Apply migrations to update the database schema in staging/production

${chalk.bold.yellow('WARNING')} ${chalk.bold(
    "Prisma's migration functionality is currently in Early Access.",
  )}
${chalk.dim(
  'When using any of the commands below you need to explicitly opt-in via the --early-access-feature flag.',
)}

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma migrate deploy [options] --early-access-feature

${chalk.bold('Options')}

  -h, --help   Display this help message
    --schema   Custom path to your Prisma schema
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

    if (!schemaPath) {
      throw new NoSchemaFoundError()
    }

    console.info(
      chalk.dim(
        `Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    throwUpgradeErrorIfOldMigrate(schemaPath)

    const migrate = new Migrate(schemaPath)

    // Automatically create the database if it doesn't exist
    const wasDbCreated = await ensureDatabaseExists('apply', true, schemaPath)
    if (wasDbCreated) {
      console.info() // empty line
      console.info(wasDbCreated)
    }

    const {
      appliedMigrationNames: migrationIds,
    } = await migrate.applyMigrations()

    migrate.stop()

    console.info() // empty line
    if (migrationIds.length === 0) {
      return `Database schema unchanged, all migrations are already applied.`
    } else {
      return `The following migration(s) have been applied:\n\n${chalk(
        printFilesFromMigrationIds('migrations', migrationIds, {
          'migration.sql': '',
        }),
      )}`
    }
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${MigrateDeploy.help}`,
      )
    }
    return MigrateDeploy.help
  }
}
