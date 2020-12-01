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
import { printFilesFromMigrationIds } from '../utils/printFiles'
import { isOldMigrate } from '../utils/detectOldMigrate'

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

    const migrate = new Migrate(schemaPath)

    // Automatically create the database if it doesn't exist
    const wasDbCreated = await ensureDatabaseExists('apply', true, schemaPath)
    if (wasDbCreated) {
      console.info()
      console.info(wasDbCreated)
    }

    const {
      appliedMigrationNames: migrationIds,
    } = await migrate.applyMigrations()

    migrate.stop()

    if (migrationIds.length === 0) {
      return `\n${chalk.green(
        'Everything is already in sync',
      )} - Prisma Migrate didn't find unapplied migrations.`
    } else {
      return `\nPrisma Migrate applied the following migration(s):\n\n${chalk(
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
