import {
  arg,
  Command,
  format,
  getCommandWithExecutor,
  getSchemaPath,
  HelpError,
  isError,
  isCi,
} from '@prisma/sdk'
import chalk from 'chalk'
import path from 'path'
import prompt from 'prompts'
import { Migrate } from '../Migrate'
import {
  EarlyAcessFlagError,
  ExperimentalFlagWithNewMigrateError,
} from '../utils/flagErrors'
import { NoSchemaFoundError, EnvNonInteractiveError } from '../utils/errors'
import { printFilesFromMigrationIds } from '../utils/printFiles'
import { throwUpgradeErrorIfOldMigrate } from '../utils/detectOldMigrate'
import {
  ensureCanConnectToDatabase,
  getDbInfo,
} from '../utils/ensureDatabaseExists'

export class MigrateReset implements Command {
  public static new(): MigrateReset {
    return new MigrateReset()
  }

  private static help = format(`
Reset your database and apply all migrations

${chalk.bold.yellow('WARNING')} ${chalk.bold(
    "Prisma's migration functionality is currently in Early Access.",
  )}
${chalk.dim(
  'When using any of the commands below you need to explicitly opt-in via the --early-access-feature flag.',
)}

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma migrate reset [options] --early-access-feature

${chalk.bold('Options')}

       -h, --help   Display this help message
         --schema   Custom path to your Prisma schema
  --skip-generate   Skip generating artifacts (e.g. Prisma Client)

${chalk.bold('Examples')}

  Reset your database, structure and data will be lost
  ${chalk.dim('$')} prisma migrate reset --early-access-feature

  Specify a schema
  ${chalk.dim(
    '$',
  )} prisma migrate reset --schema=./schema.prisma --early-access-feature 
  `)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      // '--force': Boolean,
      // '-f': '--force',
      '--skip-generate': Boolean,
      '--experimental': Boolean,
      '--early-access-feature': Boolean,
      '--schema': String,
      '--telemetry-information': String,
    })

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

    const dbInfo = await getDbInfo(schemaPath)
    console.info(
      chalk.dim(
        `Datasource "${dbInfo.name}": ${dbInfo.dbType} ${dbInfo.schemaWord} "${dbInfo.dbName}" at "${dbInfo.dbLocation}"`,
      ),
    )

    throwUpgradeErrorIfOldMigrate(schemaPath)

    await ensureCanConnectToDatabase(schemaPath)

    if (!args['--force']) {
      // We use prompts.inject() for testing in our CI
      if (isCi() && Boolean((prompt as any)._injected?.length) === false) {
        throw new EnvNonInteractiveError()
      }

      console.info() // empty line
      const confirmation = await prompt({
        type: 'confirm',
        name: 'value',
        message: `Are you sure you want to reset your database? ${chalk.red(
          'All data will be lost',
        )}.`,
      })

      if (!confirmation.value) {
        console.info('Reset cancelled.')
        process.exit(0)
        // For snapshot test, because exit() is mocked
        return ``
      }
    }

    const migrate = new Migrate(schemaPath)

    await migrate.reset()

    const {
      appliedMigrationNames: migrationIds,
    } = await migrate.applyMigrations()
    migrate.stop()

    if (migrationIds.length === 0) {
      console.info(`\n${chalk.green('Database reset successful')}`)
    } else {
      console.info(
        `\n${chalk.green('Database reset successful')}

The following migration(s) have been applied:\n\n${chalk(
          printFilesFromMigrationIds('migrations', migrationIds, {
            'migration.sql': '',
          }),
        )}`,
      )

      // Run if not skipped
      if (!process.env.MIGRATE_SKIP_GENERATE && !args['--skip-generate']) {
        await migrate.tryToRunGenerate()
      }
    }

    return ``
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${MigrateReset.help}`,
      )
    }
    return MigrateReset.help
  }
}
