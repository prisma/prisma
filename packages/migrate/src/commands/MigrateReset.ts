import {
  arg,
  checkUnsupportedDataProxy,
  Command,
  format,
  getSchemaPath,
  HelpError,
  isCi,
  isError,
  isInteractive,
  loadEnvFile,
} from '@prisma/internals'
import chalk from 'chalk'
import prompt from 'prompts'

import { Migrate } from '../Migrate'
import { throwUpgradeErrorIfOldMigrate } from '../utils/detectOldMigrate'
import { ensureDatabaseExists } from '../utils/ensureDatabaseExists'
import { MigrateResetEnvNonInteractiveError } from '../utils/errors'
import { EarlyAccessFeatureFlagWithMigrateError, ExperimentalFlagWithMigrateError } from '../utils/flagErrors'
import { getSchemaPathAndPrint } from '../utils/getSchemaPathAndPrint'
import { printDatasource } from '../utils/printDatasource'
import { printFilesFromMigrationIds } from '../utils/printFiles'
import { executeSeedCommand, getSeedCommandFromPackageJson, verifySeedConfigAndReturnMessage } from '../utils/seed'

export class MigrateReset implements Command {
  public static new(): MigrateReset {
    return new MigrateReset()
  }

  private static help = format(`
Reset your database and apply all migrations, all data will be lost

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma migrate reset [options]

${chalk.bold('Options')}

       -h, --help   Display this help message
         --schema   Custom path to your Prisma schema
  --skip-generate   Skip triggering generators (e.g. Prisma Client)
      --skip-seed   Skip triggering seed
      -f, --force   Skip the confirmation prompt

${chalk.bold('Examples')}

  Reset your database and apply all migrations, all data will be lost
  ${chalk.dim('$')} prisma migrate reset

  Specify a schema
  ${chalk.dim('$')} prisma migrate reset --schema=./schema.prisma 

  Use --force to skip the confirmation prompt
  ${chalk.dim('$')} prisma migrate reset --force
  `)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--force': Boolean,
      '-f': '--force',
      '--skip-generate': Boolean,
      '--skip-seed': Boolean,
      '--experimental': Boolean,
      '--early-access-feature': Boolean,
      '--schema': String,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    await checkUnsupportedDataProxy('migrate reset', args, true)

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

    // Automatically create the database if it doesn't exist
    const wasDbCreated = await ensureDatabaseExists('create', true, schemaPath)
    if (wasDbCreated) {
      console.info() // empty line
      console.info(wasDbCreated)
    }

    console.info() // empty line
    if (!args['--force']) {
      // We use prompts.inject() for testing in our CI
      // If not TTY or in CI we want to throw an error and not prompt.
      // Prompting when non interactive is not possible.
      // Prompting in CI would hang forever / until a timeout occurs.
      if ((!isInteractive() || isCi()) && Boolean((prompt as any)._injected?.length) === false) {
        throw new MigrateResetEnvNonInteractiveError()
      }

      const confirmation = await prompt({
        type: 'confirm',
        name: 'value',
        message: `Are you sure you want to reset your database? ${chalk.red('All data will be lost')}.`,
      })

      console.info() // empty line

      if (!confirmation.value) {
        console.info('Reset cancelled.')
        process.exit(0)
      }
    }

    const migrate = new Migrate(schemaPath)

    let migrationIds: string[]
    try {
      await migrate.reset()

      const { appliedMigrationNames } = await migrate.applyMigrations()
      migrationIds = appliedMigrationNames
    } finally {
      // Stop engine
      migrate.stop()
    }

    if (migrationIds.length === 0) {
      console.info(`${chalk.green('Database reset successful\n')}`)
    } else {
      console.info() // empty line
      console.info(
        `${chalk.green('Database reset successful')}

The following migration(s) have been applied:\n\n${chalk(
          printFilesFromMigrationIds('migrations', migrationIds, {
            'migration.sql': '',
          }),
        )}`,
      )
    }

    // Run if not skipped
    if (!process.env.PRISMA_MIGRATE_SKIP_GENERATE && !args['--skip-generate']) {
      await migrate.tryToRunGenerate()
    }

    // Run if not skipped
    if (!process.env.PRISMA_MIGRATE_SKIP_SEED && !args['--skip-seed']) {
      const seedCommandFromPkgJson = await getSeedCommandFromPackageJson(process.cwd())

      if (seedCommandFromPkgJson) {
        console.info() // empty line
        const successfulSeeding = await executeSeedCommand(seedCommandFromPkgJson)
        if (successfulSeeding) {
          console.info(`\n${process.platform === 'win32' ? '' : '🌱  '}The seed command has been executed.`)
        } else {
          process.exit(1)
        }
      } else {
        // Only used to help users to set up their seeds from old way to new package.json config
        const schemaPath = await getSchemaPath(args['--schema'])
        // we don't want to output the returned warning message
        // but we still want to run it for `legacyTsNodeScriptWarning()`
        await verifySeedConfigAndReturnMessage(schemaPath)
      }
    }

    return ``
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${MigrateReset.help}`)
    }
    return MigrateReset.help
  }
}
