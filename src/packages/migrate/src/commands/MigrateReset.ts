import {
  arg,
  Command,
  format,
  getSchemaPath,
  HelpError,
  isError,
  isCi,
  link,
} from '@prisma/sdk'
import chalk from 'chalk'
import path from 'path'
import prompt from 'prompts'
import { Migrate } from '../Migrate'
import {
  PreviewFlagError,
  ExperimentalFlagWithNewMigrateError,
  EarlyAccessFeatureFlagWithNewMigrateError,
} from '../utils/flagErrors'
import { NoSchemaFoundError, EnvNonInteractiveError } from '../utils/errors'
import { printFilesFromMigrationIds } from '../utils/printFiles'
import { throwUpgradeErrorIfOldMigrate } from '../utils/detectOldMigrate'
import { ensureDatabaseExists } from '../utils/ensureDatabaseExists'
import { printDatasource } from '../utils/printDatasource'
import { tryToRunSeed, detectSeedFiles } from '../utils/seed'

export class MigrateReset implements Command {
  public static new(): MigrateReset {
    return new MigrateReset()
  }

  private static help = format(`
Reset your database and apply all migrations, all data will be lost

${chalk.bold.yellow('WARNING')} ${chalk.bold(
    `Prisma's migration functionality is currently in Preview (${link(
      'https://pris.ly/d/preview',
    )}).`,
  )}
${chalk.dim(
  'When using any of the commands below you need to explicitly opt-in via the --preview-feature flag.',
)}

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma migrate reset [options] --preview-feature

${chalk.bold('Options')}

       -h, --help   Display this help message
         --schema   Custom path to your Prisma schema
  --skip-generate   Skip triggering generators (e.g. Prisma Client)
      -f, --force   Skip the confirmation prompt


${chalk.bold('Examples')}

  Reset your database and apply all migrations, all data will be lost
  ${chalk.dim('$')} prisma migrate reset --preview-feature

  Specify a schema
  ${chalk.dim(
    '$',
  )} prisma migrate reset --schema=./schema.prisma --preview-feature 

  Use --force to skip the confirmation prompt
  ${chalk.dim('$')} prisma migrate reset --force --preview-feature
  `)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--force': Boolean,
      '-f': '--force',
      '--skip-generate': Boolean,
      '--experimental': Boolean,
      '--preview-feature': Boolean,
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

    console.info() // empty line

    throwUpgradeErrorIfOldMigrate(schemaPath)

    // Automatically create the database if it doesn't exist
    const wasDbCreated = await ensureDatabaseExists('create', true, schemaPath)
    if (wasDbCreated) {
      console.info(wasDbCreated)
    }

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
      console.info(`${chalk.green('Database reset successful')}`)
    } else {
      console.info(
        `${chalk.green('Database reset successful')}

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

    // Run seed if 1 or more seed files are present
    const detected = detectSeedFiles()
    if (detected.numberOfSeedFiles > 0) {
      await tryToRunSeed()
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
